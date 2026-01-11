#!/bin/bash
# Database maintenance script
# Runs VACUUM and ANALYZE on main tables

docker exec -i bedriftsgrafen-db psql -U admin -d bedriftsgrafen << 'SQL'
VACUUM bedrifter;
VACUUM regnskap;
ANALYZE bedrifter;
ANALYZE regnskap;
SQL

echo "Database maintenance completed at $(date)"
