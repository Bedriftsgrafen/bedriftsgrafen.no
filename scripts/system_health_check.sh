#!/bin/bash
# System Health Check for Bedriftsgrafen.no
# Run this to verify system status

# Project root directory (defaults to current directory if not set)
PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║          Bedriftsgrafen.no - System Health Check             ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# 1. Docker Containers
echo "📦 Docker Containers:"
docker ps --format "  {{.Names}}: {{.Status}}" | grep bedriftsgrafen
echo ""

# 2. Database Status
echo "💾 Database Status:"
docker exec bedriftsgrafen-db psql -U admin -d bedriftsgrafen -t -c "SELECT '  Companies: ' || COUNT(*) FROM bedrifter;"
docker exec bedriftsgrafen-db psql -U admin -d bedriftsgrafen -t -c "SELECT '  Statements: ' || COUNT(*) FROM regnskap;"
docker exec bedriftsgrafen-db psql -U admin -d bedriftsgrafen -t -c "SELECT '  DB Size: ' || pg_size_pretty(pg_database_size('bedriftsgrafen'));"
docker exec bedriftsgrafen-db psql -U admin -d bedriftsgrafen -t -c "SELECT '  Shared Memory: ' || pg_size_pretty(SUM(setting::bigint)*1024) FROM pg_settings WHERE name = 'shared_buffers';"
echo ""

# 3. Disk Space
echo "💿 Disk Space:"
df -h / | tail -1 | awk '{print "  Root: " $3 " used / " $2 " total (" $5 " used)"}'
df -h "${PROJECT_ROOT}" | tail -1 | awk '{print "  Project: " $3 " used / " $2 " total (" $5 " used)"}'
du -sh "${PROJECT_ROOT}/backups" 2>/dev/null | awk '{print "  Backups: " $1}'
echo ""

# 4. Shared Memory
echo "🧠 Container Shared Memory:"
docker exec bedriftsgrafen-db df -h /dev/shm | tail -1 | awk '{print "  /dev/shm: " $3 " used / " $2 " total (" $5 " used)"}'
echo ""

# 5. Cron Jobs
echo "⏰ Cron Jobs Installed:"
crontab -l | grep -v "^#" | grep -v "^$" | wc -l | awk '{print "  Active jobs: " $1}'
echo ""

# 6. Recent Logs
echo "📋 Recent Activity:"
if [ -f "${PROJECT_ROOT}/logs/db_maintenance.log" ]; then
    echo "  Last maintenance: $(tail -1 "${PROJECT_ROOT}/logs/db_maintenance.log" 2>/dev/null || echo 'Not run yet')"
fi
if [ -f "${PROJECT_ROOT}/logs/updates.log" ]; then
    echo "  Last update check: $(tail -1 "${PROJECT_ROOT}/logs/updates.log" 2>/dev/null || echo 'Not run yet')"
fi
echo ""

# 7. API Health
echo "🌐 API Status:"
curl -s http://localhost:8000/health | python3 -m json.tool 2>/dev/null | grep -E "status|database" | sed 's/^/  /'
echo ""

# 8. Tracking Columns
echo "📊 Data Quality:"
docker exec bedriftsgrafen-db psql -U admin -d bedriftsgrafen -t -c "SELECT '  Companies with timestamps: ' || COUNT(*) FROM bedrifter WHERE created_at IS NOT NULL;"
docker exec bedriftsgrafen-db psql -U admin -d bedriftsgrafen -t -c "SELECT '  Oldest import: ' || MIN(created_at)::date FROM bedrifter WHERE created_at IS NOT NULL;"
echo ""

echo "✅ Health check complete!"
echo ""
