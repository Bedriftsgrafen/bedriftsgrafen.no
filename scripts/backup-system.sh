#!/usr/bin/env bash
# Bedriftsgrafen.no System Backup
# Uses rsync with hard-linked snapshots for space-efficient incremental backups
set -euo pipefail

# Set PATH for cron execution
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin


# Parse arguments
DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "=== DRY RUN MODE: No changes will be saved ==="
fi

# Ensure running as root for full system backup
if [ "$EUID" -ne 0 ] && [ "$DRY_RUN" = false ]; then
   echo "Error: This script must be run as root to backup the whole system."
   exit 1
fi

# Cleanup trap for dry-run
cleanup() {
    if [ "$DRY_RUN" = true ] && [ -n "${DEST:-}" ] && [ -d "$DEST" ]; then
        echo "[DRY-RUN] Cleaning up temporary directory $DEST" | tee -a "$LOG_FILE"
        rm -rf "$DEST"
    fi
}
trap cleanup EXIT

# Avoid HOME dependency as it varies by user/root
TARGET="/mnt/ssd/backups"

# Verify mount point to prevent writing to local disk
if ! mountpoint -q "/mnt/ssd"; then
    echo "CRITICAL ERROR: Backup drive not mounted at /mnt/ssd"
    exit 1
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DEST="$TARGET/$TIMESTAMP"
CURRENT="$TARGET/current"
LOG_FILE="$TARGET/backup.log"

# Directories to exclude (virtual filesystems, mounts, temp, build artifacts)
EXCLUDES=(
  "/dev/*"
  "/proc/*"
  "/sys/*"
  "/tmp/*"
  "/run/*"
  "/mnt/*"
  "/media/*"
  "/lost+found"
  "/var/tmp/*"
  "/var/cache/*"
  "/home/*/.cache/*"
  "/swapfile"
  "/var/swap"
  # Docker build cache
  "/var/lib/docker/overlay2/*"
  "/var/lib/docker/tmp/*"
  # Node.js
  "*/node_modules/*"
  "*/.npm/*"
  # Python
  "*/__pycache__/*"
  "*/.pytest_cache/*"
  "*/.venv/*"
  "*/venv/*"
  "*/.mypy_cache/*"
  # Frontend build artifacts
  "*/dist/*"
  "*/build/*"
  "*/.next/*"
  "*/.nuxt/*"
  # Logs (we'll backup separately)
  "*/logs/*.log"
  # Git
  "*/.git/objects/*"
  "*/.git/index.lock"
  # Backup old directory we'll delete anyway
  "/home/*/bedriftsgrafen.no.old/*"
)

# Build --exclude arguments
EXCLUDE_ARGS=()
for e in "${EXCLUDES[@]}"; do
  EXCLUDE_ARGS+=(--exclude="$e")
done

# Create destination directory
mkdir -p "$DEST"

# Log start
echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting backup to $DEST" | tee -a "$LOG_FILE"

# Use previous snapshot for hard-linking if exists
LINK_DEST_ARG=()
if [ -d "$CURRENT" ]; then
  LINK_DEST_ARG=(--link-dest="$CURRENT")
  echo "Using previous snapshot for hard links: $CURRENT" | tee -a "$LOG_FILE"
fi

# Backup PostgreSQL database first
DB_BACKUP_DIR="$DEST/db_dumps"
mkdir -p "$DB_BACKUP_DIR"
echo "$(date '+%Y-%m-%d %H:%M:%S') - Backing up PostgreSQL..." | tee -a "$LOG_FILE"
if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] Would run: docker exec bedriftsgrafen-db pg_dumpall -U admin > $DB_BACKUP_DIR/pg_dumpall.sql" | tee -a "$LOG_FILE"
else
    docker exec bedriftsgrafen-db pg_dumpall -U admin > "$DB_BACKUP_DIR/pg_dumpall.sql" 2>&1 || echo "Warning: DB dump failed" | tee -a "$LOG_FILE"
fi

# Run rsync: preserve permissions, xattrs, ACLs, hard links, devices
# Use --info=progress2 for better progress tracking
echo "$(date '+%Y-%m-%d %H:%M:%S') - Running rsync..." | tee -a "$LOG_FILE"
RSYNC_OPTS=(
  -aAX
  --stats
  "${LINK_DEST_ARG[@]}"
  "${EXCLUDE_ARGS[@]}"
  --delete
)

if [ "$DRY_RUN" = true ]; then
    RSYNC_OPTS+=(--dry-run)
    echo "[DRY-RUN] Running rsync in simulation mode..." | tee -a "$LOG_FILE"
fi

# Allow partial transfers (code 23/24) which are common with live files/permissions
rsync "${RSYNC_OPTS[@]}" / "$DEST/" 2>&1 | tee -a "$LOG_FILE" || {
    rc=$?
    if [[ $rc -eq 23 || $rc -eq 24 ]]; then
        echo "Warning: rsync completed with some errors (code $rc)" | tee -a "$LOG_FILE"
    else
        echo "Error: rsync failed with code $rc" | tee -a "$LOG_FILE"
        exit $rc
    fi
}

# Update 'current' symlink atomically
if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] Would update symlink 'current' to $DEST" | tee -a "$LOG_FILE"
else
    tmplink="$TARGET/.current_tmp"
    ln -sfn "$DEST" "$tmplink"
    mv -T "$tmplink" "$CURRENT"
fi

# Keep only last 7 backups (remove older ones)
echo "$(date '+%Y-%m-%d %H:%M:%S') - Cleaning old backups..." | tee -a "$LOG_FILE"
if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] Would clean up old backups..." | tee -a "$LOG_FILE"
else
    cd "$TARGET"
    # Use sort (name-based) because mtimes are unreliable (rsync preserves source dir time)
    # This keeps the 7 folders with the highest names (latest dates)
    ls -1d */ 2>/dev/null | grep -E '^[0-9]{8}-[0-9]{6}/$' | sort -r | tail -n +8 | xargs -r rm -rf
fi

# Log completion
BACKUP_SIZE=$(du -sh "$DEST" | cut -f1)
echo "$(date '+%Y-%m-%d %H:%M:%S') - Backup complete: $DEST (Size: $BACKUP_SIZE)" | tee -a "$LOG_FILE"
echo "---" | tee -a "$LOG_FILE"
