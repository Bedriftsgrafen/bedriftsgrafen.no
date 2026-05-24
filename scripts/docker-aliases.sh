#!/bin/bash
# =============================================================================
# Bedriftsgrafen Docker Aliases
# =============================================================================
#
# Installer ved å legge til i ~/.bashrc:
#   source /path/to/bedriftsgrafen.no/scripts/docker-aliases.sh
#
# =============================================================================

# Project directory (auto-detected from script location)
BEDRIFTSGRAFEN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export BEDRIFTSGRAFEN_DIR

# =============================================================================
# PROD COMMANDS
# =============================================================================

# Start/stop prod
alias prod-up='docker compose -f $BEDRIFTSGRAFEN_DIR/docker-compose.prod.yml up -d'
alias prod-down='docker compose -f $BEDRIFTSGRAFEN_DIR/docker-compose.prod.yml down'
alias prod-restart='docker compose -f $BEDRIFTSGRAFEN_DIR/docker-compose.prod.yml restart'
alias prod-build='docker compose -f $BEDRIFTSGRAFEN_DIR/docker-compose.prod.yml up -d --build'
alias prod-logs='docker compose -f $BEDRIFTSGRAFEN_DIR/docker-compose.prod.yml logs -f'
alias prod-ps='docker compose -f $BEDRIFTSGRAFEN_DIR/docker-compose.prod.yml ps'

# Prod specific logs
alias prod-backend-logs='docker logs -f bedriftsgrafen-backend'
alias prod-worker-logs='docker logs -f bedriftsgrafen-worker'
alias prod-frontend-logs='docker logs -f bedriftsgrafen-frontend'

# =============================================================================
# OBSERVABILITY COMMANDS
# =============================================================================

# Start/stop observability stack (Grafana, Prometheus, Loki, Alloy)
alias observe-up='docker compose -f $BEDRIFTSGRAFEN_DIR/docker-compose.observability.yml up -d'
alias observe-down='docker compose -f $BEDRIFTSGRAFEN_DIR/docker-compose.observability.yml down'
alias observe-restart='docker compose -f $BEDRIFTSGRAFEN_DIR/docker-compose.observability.yml restart'
alias observe-build='docker compose -f $BEDRIFTSGRAFEN_DIR/docker-compose.observability.yml pull && docker compose -f $BEDRIFTSGRAFEN_DIR/docker-compose.observability.yml up -d --remove-orphans'
alias observe-logs='docker compose -f $BEDRIFTSGRAFEN_DIR/docker-compose.observability.yml logs -f'
alias observe-ps='docker compose -f $BEDRIFTSGRAFEN_DIR/docker-compose.observability.yml ps'

# Observability specific logs
alias observe-grafana-logs='docker logs -f monitoring-grafana'
alias observe-prometheus-logs='docker logs -f monitoring-prometheus'
alias observe-loki-logs='docker logs -f monitoring-loki'
alias observe-alloy-logs='docker logs -f monitoring-alloy'
alias observe-cadvisor-logs='docker logs -f monitoring-cadvisor'
alias observe-node-logs='docker logs -f monitoring-node-exporter'

observe-health() {
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "monitoring-|NAMES"
}

observe-targets() {
    docker exec monitoring-prometheus wget -q -O - "http://localhost:9090/api/v1/targets?state=active" \
        | python3 -m json.tool 2>/dev/null || cat
}

observe-target-summary() {
    docker exec monitoring-prometheus wget -q -O - "http://localhost:9090/api/v1/targets?state=active" \
        | python3 -c 'import json,sys; data=json.load(sys.stdin); targets=data["data"]["activeTargets"]; bad=[(t["labels"].get("job"), t["labels"].get("instance"), t["health"], t.get("lastError", "")) for t in targets if t["health"] != "up"]; print(f"targets {len(targets)} bad {len(bad)}"); [print(*item) for item in bad]'
}

observe-discord-test() {
    local webhook_file="$BEDRIFTSGRAFEN_DIR/observability/secrets/discord_webhook_url"
    if [[ ! -s "$webhook_file" ]]; then
        echo "Discord webhook secret missing: $webhook_file"
        return 1
    fi

    curl -fsS \
        -H "Content-Type: application/json" \
        -d "{\"content\":\"Bedriftsgrafen observability test from $(hostname) at $(date -Is).\"}" \
        "$(cat "$webhook_file")" >/dev/null \
        && echo "Discord test alert sent."
}

adtraction-dry-run() {
    (cd "$BEDRIFTSGRAFEN_DIR" && backend/.venv/bin/python backend/scripts/adtraction_notifier.py --dry-run "$@")
}

adtraction-send() {
    (cd "$BEDRIFTSGRAFEN_DIR" && backend/.venv/bin/python backend/scripts/adtraction_notifier.py --send-discord "$@")
}

adtraction-mark-seen() {
    (cd "$BEDRIFTSGRAFEN_DIR" && backend/.venv/bin/python backend/scripts/adtraction_notifier.py --mark-seen "$@")
}

adtraction-timer-status() {
    systemctl status bedriftsgrafen-adtraction-notifier.timer
}

# =============================================================================
# DEV COMMANDS
# =============================================================================

bg_open_dev_url() {
    local url="http://localhost:5173"

    if [[ -n "${SSH_CONNECTION:-}" || -n "${SSH_TTY:-}" ]]; then
        local lan_ip
        lan_ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
        echo ""
        echo "Dev frontend is running on the server: $url"
        if [[ -n "$lan_ip" ]]; then
            echo "LAN URL from the same network: http://$lan_ip:5173"
            echo "From your own machine, use VS Code port forwarding or:"
            echo "  ssh -L 5173:localhost:5173 $USER@$lan_ip"
        else
            echo "From your own machine, use VS Code port forwarding or:"
            echo "  ssh -L 5173:localhost:5173 $USER@<server-host>"
        fi
        echo "Then open http://localhost:5173 locally."
        return 0
    fi

    if command -v xdg-open >/dev/null 2>&1; then
        xdg-open "$url" >/dev/null 2>&1 &
    else
        echo "Dev frontend: $url"
    fi
}

# Start/stop dev
alias dev-up='docker compose -f $BEDRIFTSGRAFEN_DIR/docker-compose.dev.yml up -d --remove-orphans && bg_open_dev_url'
alias dev-down='docker compose -f $BEDRIFTSGRAFEN_DIR/docker-compose.dev.yml down'
alias dev-restart='docker compose -f $BEDRIFTSGRAFEN_DIR/docker-compose.dev.yml restart'
alias dev-build='docker compose -f $BEDRIFTSGRAFEN_DIR/docker-compose.dev.yml up -d --build --remove-orphans && bg_open_dev_url'
alias dev-logs='docker compose -f $BEDRIFTSGRAFEN_DIR/docker-compose.dev.yml logs -f'
alias dev-ps='docker compose -f $BEDRIFTSGRAFEN_DIR/docker-compose.dev.yml ps'

# Dev backend logs specifically
alias dev-backend-logs='docker logs -f bedriftsgrafen-backend-dev'
alias dev-frontend-logs='docker logs -f bedriftsgrafen-frontend-dev'

# =============================================================================
# EXEC COMMANDS (enter containers)
# =============================================================================

# Enter containers
alias dev-backend='docker exec -it bedriftsgrafen-backend-dev bash'
alias dev-frontend='docker exec -it bedriftsgrafen-frontend-dev sh'
alias prod-backend='docker exec -it bedriftsgrafen-backend bash'
alias prod-worker='docker exec -it bedriftsgrafen-worker bash'
alias prod-frontend='docker exec -it bedriftsgrafen-frontend sh'
alias db-shell='docker exec -it bedriftsgrafen-db psql -U admin -d bedriftsgrafen'

# =============================================================================
# ALEMBIC / MIGRATIONS
# =============================================================================

# Run migrations (always from dev container)
alias migrate='docker exec -it bedriftsgrafen-backend-dev alembic upgrade head'
alias migrate-status='docker exec -it bedriftsgrafen-backend-dev alembic current'
alias migrate-history='docker exec -it bedriftsgrafen-backend-dev alembic history'

# Create new migration
migrate-new() {
    if [ -z "$1" ]; then
        echo "Usage: migrate-new \"description of migration\""
        return 1
    fi
    docker exec -it bedriftsgrafen-backend-dev alembic revision --autogenerate -m "$1"
}

# =============================================================================
# DEPLOY
# =============================================================================

alias deploy='$BEDRIFTSGRAFEN_DIR/scripts/deploy.sh'

# =============================================================================
# UTILITY
# =============================================================================

# Quick status check
alias dps='docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'

# Go to project directory
alias bg='cd $BEDRIFTSGRAFEN_DIR'

# Health checks
alias health-prod='curl -s http://localhost:3000 > /dev/null && echo "Prod Frontend: ✅" || echo "Prod Frontend: ❌"'
alias health-dev='curl -s http://localhost:5173 > /dev/null && echo "Dev Frontend: ✅" || echo "Dev Frontend: ❌"; curl -s http://localhost:8001/health && echo " Dev Backend: ✅" || echo "Dev Backend: ❌"'

# =============================================================================
# HELP
# =============================================================================

bg-help() {
    echo ""
    echo "🚀 Bedriftsgrafen Docker Aliases"
    echo "================================="
    echo ""
    echo "PROD:"
    echo "  prod-up        Start prod stack"
    echo "  prod-down      Stop prod stack"
    echo "  prod-build     Rebuild and start prod"
    echo "  prod-logs      Follow prod logs"
    echo "  prod-ps        Show prod containers"
    echo ""
    echo "DEV:"
    echo "  dev-up         Start dev stack"
    echo "  dev-down       Stop dev stack"
    echo "  dev-build      Rebuild and start dev"
    echo "  dev-logs       Follow dev logs"
    echo "  dev-ps         Show dev containers"
    echo ""
    echo "OBSERVABILITY:"
    echo "  observe-up     Start observability stack"
    echo "  observe-down   Stop observability stack"
    echo "  observe-build  Pull images and start observability"
    echo "  observe-logs   Follow observability logs"
    echo "  observe-ps     Show observability containers"
    echo "  observe-health Show monitoring container health"
    echo "  observe-targets Show Prometheus scrape targets"
    echo "  observe-target-summary Show unhealthy Prometheus targets"
    echo "  observe-discord-test Send a Discord webhook test"
    echo "  adtraction-dry-run  Preview Adtraction money events"
    echo "  adtraction-send     Send unseen Adtraction money events to Discord"
    echo "  adtraction-mark-seen Mark current Adtraction events as seen"
    echo "  adtraction-timer-status Show notifier timer status"
    echo ""
    echo "EXEC:"
    echo "  dev-backend    Enter dev backend container"
    echo "  dev-frontend   Enter dev frontend container"
    echo "  prod-backend   Enter prod backend container"
    echo "  prod-worker    Enter prod worker container"
    echo "  db-shell       PostgreSQL shell"
    echo ""
    echo "LOGS:"
    echo "  prod-backend-logs  Follow API logs"
    echo "  prod-worker-logs   Follow background worker logs"
    echo "  dev-backend-logs   Follow dev backend logs"
    echo ""
    echo ""
    echo "MIGRATIONS:"
    echo "  migrate        Run pending migrations"
    echo "  migrate-status Show current migration"
    echo "  migrate-new    Create new migration"
    echo ""
    echo "ADMIN (type 'admin-help' for details):"
    echo "  admin-updates  Run incremental update"
    echo "  admin-progress Check import progress"
    echo "  admin-geocode  Run geocoding batch"
    echo ""
    echo "UTILITY:"
    echo "  deploy         Run deploy script"
    echo "  dps            Quick docker ps"
    echo "  bg             Go to project directory"
    echo "  health-prod    Check prod health"
    echo "  health-dev     Check dev health"
    echo ""
}

# =============================================================================
# ADMIN ENDPOINTS
# =============================================================================

# Load admin API key from .env
_load_admin_key() {
    if [ -z "$ADMIN_API_KEY" ]; then
        if [ -f "$BEDRIFTSGRAFEN_DIR/.env" ]; then
            ADMIN_API_KEY=$(grep "^ADMIN_API_KEY=" "$BEDRIFTSGRAFEN_DIR/.env" | cut -d'=' -f2)
            export ADMIN_API_KEY
        fi
    fi
    if [ -z "$ADMIN_API_KEY" ]; then
        echo "❌ Error: ADMIN_API_KEY not set. Check .env file."
        return 1
    fi
    return 0
}

# Base URL for admin API (via frontend proxy)
ADMIN_API_BASE="http://localhost:3000/api"

# Admin API call helper
_admin_call() {
    local method="$1"
    local endpoint="$2"
    local data="$3"

    _load_admin_key || return 1

    if [ "$method" = "GET" ]; then
        curl -s -X GET \
            -H "X-Admin-Key: $ADMIN_API_KEY" \
            "$ADMIN_API_BASE$endpoint" | python3 -m json.tool 2>/dev/null || cat
    else
        curl -s -X POST \
            -H "X-Admin-Key: $ADMIN_API_KEY" \
            -H "Content-Type: application/json" \
            -d "${data:-{}}" \
            "$ADMIN_API_BASE$endpoint" | python3 -m json.tool 2>/dev/null || cat
    fi
    echo ""
}

# Incremental updates from Brønnøysund
admin-updates() {
    local limit="${1:-100}"
    echo "🔄 Running incremental update (limit: $limit)..."
    _admin_call POST "/admin/import/updates" "{\"limit\": $limit}"
}

# Check import progress
admin-progress() {
    echo "📊 Import progress:"
    _admin_call GET "/admin/import/progress"
}

# Run geocoding batch
admin-geocode() {
    echo "🗺️  Running geocoding batch..."
    _admin_call POST "/admin/import/geocode"
}

# Check geocoding status
admin-geocode-status() {
    echo "🗺️  Geocoding status:"
    _admin_call GET "/admin/import/geocode/status"
}

# Start geocoding fast-fill (background)
admin-geocode-fast() {
    echo "⚡ Starting fast geocoding backfill..."
    _admin_call POST "/admin/import/geocode/fast-fill"
}

# Sync SSB population data
admin-ssb() {
    echo "📈 Syncing SSB population data..."
    _admin_call POST "/admin/import/ssb/population"
}

# Retry failed imports
admin-retry() {
    echo "🔁 Retrying failed imports..."
    _admin_call POST "/admin/import/retry-failed"
}

# Start bulk import (careful!)
admin-bulk-start() {
    echo "⚠️  Starting bulk import (background)..."
    read -p "Are you sure? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        _admin_call POST "/admin/import/bulk/start" "{\"batch_name\": \"manual\"}"
    else
        echo "Cancelled."
    fi
}

# Admin help
admin-help() {
    echo ""
    echo "🔐 Bedriftsgrafen Admin Commands"
    echo "================================="
    echo ""
    echo "UPDATES:"
    echo "  admin-updates [limit]    Run incremental update (default: 100)"
    echo "  admin-progress           Check import progress"
    echo "  admin-retry              Retry failed imports"
    echo ""
    echo "GEOCODING:"
    echo "  admin-geocode            Run geocoding batch (100 companies)"
    echo "  admin-geocode-status     Check geocoding progress"
    echo "  admin-geocode-fast       Start fast backfill (background)"
    echo ""
    echo "DATA SYNC:"
    echo "  admin-ssb                Sync SSB population data"
    echo "  admin-bulk-start         Start bulk import (⚠️ SLOW)"
    echo ""
    echo "Examples:"
    echo "  admin-updates 500        Process up to 500 updates"
    echo "  admin-geocode-status     Show geocoding completion %"
    echo ""
}

echo "✅ Bedriftsgrafen aliases loaded. Type 'bg-help' for commands."
