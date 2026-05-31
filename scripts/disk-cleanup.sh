#!/bin/bash
set -euo pipefail

# Conservative disk maintenance for the production host.
# This script removes only regenerable caches by default. It reports dangling
# Docker volumes, but does not delete them because they may contain old data.

PROJECT_ROOT="${PROJECT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
TARGET_HOME="${TARGET_HOME:-/home/k1sso}"

DOCKER_BUILDER_UNTIL="${DOCKER_BUILDER_UNTIL:-168h}"
DOCKER_IMAGE_UNTIL="${DOCKER_IMAGE_UNTIL:-168h}"
DOCKER_CONTAINER_UNTIL="${DOCKER_CONTAINER_UNTIL:-168h}"
JOURNAL_VACUUM_SIZE="${JOURNAL_VACUUM_SIZE:-300M}"
NPM_NPX_MAX_AGE_DAYS="${NPM_NPX_MAX_AGE_DAYS:-14}"
TRIVY_CACHE_MAX_AGE_DAYS="${TRIVY_CACHE_MAX_AGE_DAYS:-14}"
GEMINI_TMP_MAX_AGE_DAYS="${GEMINI_TMP_MAX_AGE_DAYS:-14}"
ALERT_THRESHOLD_PERCENT="${ALERT_THRESHOLD_PERCENT:-80}"

log() {
    printf '[%s] %s\n' "$(date -Is)" "$*"
}

disk_summary() {
    df -h /
}

root_usage_percent() {
    df --output=pcent / | tail -1 | tr -dc '0-9'
}

remove_old_children() {
    local path="$1"
    local max_age_days="$2"

    if [[ ! -d "$path" ]]; then
        return 0
    fi

    log "Removing entries older than ${max_age_days}d in ${path}"
    find "$path" -mindepth 1 -maxdepth 1 -mtime "+${max_age_days}" -exec rm -rf {} +
}

prune_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        log "Skipping Docker cleanup: docker command not found"
        return 0
    fi

    if ! docker info >/dev/null 2>&1; then
        log "Skipping Docker cleanup: docker daemon unavailable"
        return 0
    fi

    log "Docker disk use before cleanup"
    docker system df || true

    log "Pruning Docker builder cache older than ${DOCKER_BUILDER_UNTIL}"
    docker builder prune -af --filter "until=${DOCKER_BUILDER_UNTIL}" || true

    log "Pruning unused Docker images older than ${DOCKER_IMAGE_UNTIL}"
    docker image prune -a -f --filter "until=${DOCKER_IMAGE_UNTIL}" || true

    log "Pruning stopped Docker containers older than ${DOCKER_CONTAINER_UNTIL}"
    docker container prune -f --filter "until=${DOCKER_CONTAINER_UNTIL}" || true

    log "Docker disk use after cleanup"
    docker system df || true

    log "Dangling Docker volumes for manual review only"
    docker system df -v | awk '/Local Volumes space usage:/{flag=1} /Build cache usage:/{flag=0} flag' || true
}

vacuum_journal() {
    if ! command -v journalctl >/dev/null 2>&1; then
        log "Skipping journald cleanup: journalctl command not found"
        return 0
    fi

    log "Journald disk use before cleanup"
    journalctl --disk-usage || true

    if [[ "${EUID}" -eq 0 ]]; then
        journalctl --vacuum-size="${JOURNAL_VACUUM_SIZE}" || true
    elif sudo -n true >/dev/null 2>&1; then
        sudo -n journalctl --vacuum-size="${JOURNAL_VACUUM_SIZE}" || true
    else
        log "Skipping journald vacuum: sudo without password is unavailable"
    fi

    log "Journald disk use after cleanup"
    journalctl --disk-usage || true
}

clean_user_caches() {
    remove_old_children "${TARGET_HOME}/.npm/_npx" "${NPM_NPX_MAX_AGE_DAYS}"
    remove_old_children "${TARGET_HOME}/.cache/trivy" "${TRIVY_CACHE_MAX_AGE_DAYS}"
    remove_old_children "${TARGET_HOME}/.gemini/tmp" "${GEMINI_TMP_MAX_AGE_DAYS}"
}

main() {
    log "Starting disk cleanup in ${PROJECT_ROOT}"
    log "Disk before cleanup"
    disk_summary

    prune_docker
    vacuum_journal
    clean_user_caches

    log "Disk after cleanup"
    disk_summary


    local usage_percent
    usage_percent="$(root_usage_percent)"
    if [[ "${usage_percent}" -ge "${ALERT_THRESHOLD_PERCENT}" ]]; then
        log "WARNING: root disk usage is still ${usage_percent}%"
        log "Review dangling Docker volumes and large user data before deleting anything manually."
    fi

    log "Disk cleanup complete"
}

main "$@"