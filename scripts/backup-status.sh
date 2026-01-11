#!/usr/bin/env bash
# Quick backup status check

echo "=== Backup Status ==="
echo ""

# Check running processes
BACKUP_PID=$(pgrep -f "backup-system.sh" | head -1)
if [ -n "$BACKUP_PID" ]; then
    echo "✓ Backup running (PID: $BACKUP_PID)"
    ps -p "$BACKUP_PID" -o etime,cmd --no-headers | sed 's/^/  Runtime: /'
    
    # Check what's running
    if pgrep -f "pg_dump" > /dev/null; then
        echo "  Phase: Database dump"
        DB_SIZE=$(ls -lh /mnt/ssd/backups/*/db_dumps/pg_dumpall.sql 2>/dev/null | tail -1 | awk '{print $5}')
        [ -n "$DB_SIZE" ] && echo "  DB dump size: $DB_SIZE"
    elif pgrep -f "rsync.*backups" > /dev/null; then
        echo "  Phase: File sync"
    fi
else
    echo "✗ No backup running"
fi

echo ""
echo "=== Recent Backups ==="
ls -lht /mnt/ssd/backups/ 2>/dev/null | grep "^d" | head -5 | awk '{print $9, "-", $6, $7, $8}'

echo ""
echo "=== Last 3 Log Entries ==="
grep -E "Starting|complete|Running" /mnt/ssd/backups/backup.log 2>/dev/null | tail -3

echo ""
echo "=== Next Scheduled Backup ==="
systemctl list-timers bedriftsgrafen-backup.timer --no-pager | grep backup
