#!/bin/bash
set -e

DB_USER="admin"
DB_NAME="bedriftsgrafen"

echo "Full-Text Search Migration - Step by Step"
echo "=========================================="

echo ""
echo "Step 1: Adding search_vector column..."
docker compose exec -T db psql -U $DB_USER -d $DB_NAME << SQL
DO \$\$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bedrifter' 
        AND column_name = 'search_vector'
    ) THEN
        ALTER TABLE bedrifter ADD COLUMN search_vector tsvector;
        RAISE NOTICE 'Added search_vector column';
    ELSE
        RAISE NOTICE 'search_vector column already exists';
    END IF;
END \$\$;
SQL

echo "✓ Step 1 complete"

echo ""
echo "Step 2: Creating trigger function..."
docker compose exec -T db psql -U $DB_USER -d $DB_NAME << 'SQL'
CREATE OR REPLACE FUNCTION bedrifter_search_vector_update() 
RETURNS trigger AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('norwegian', COALESCE(NEW.navn, '')), 'A') ||
        setweight(to_tsvector('norwegian', COALESCE(NEW.orgnr, '')), 'B');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;
SQL

echo "✓ Step 2 complete"

echo ""
echo "Step 3: Creating trigger..."
docker compose exec -T db psql -U $DB_USER -d $DB_NAME << SQL
DROP TRIGGER IF EXISTS bedrifter_search_vector_trigger ON bedrifter;

CREATE TRIGGER bedrifter_search_vector_trigger
BEFORE INSERT OR UPDATE OF navn, orgnr
ON bedrifter
FOR EACH ROW
EXECUTE FUNCTION bedrifter_search_vector_update();
SQL

echo "✓ Step 3 complete"

echo ""
echo "Step 4: Creating GIN index (skipping UPDATE for now)..."
docker compose exec -T db psql -U $DB_USER -d $DB_NAME << SQL
CREATE INDEX IF NOT EXISTS bedrifter_search_vector_idx 
ON bedrifter 
USING GIN(search_vector);
SQL

echo "✓ Step 4 complete"

echo ""
echo "Step 5: Populating search_vector for existing rows (this may take a while)..."
docker compose exec -T db psql -U $DB_USER -d $DB_NAME << SQL
UPDATE bedrifter
SET orgnr = orgnr  -- This will trigger the trigger to update search_vector
WHERE search_vector IS NULL OR search_vector = ''::tsvector;
SQL

echo "✓ Step 5 complete"

echo ""
echo "Verification..."
docker compose exec -T db psql -U $DB_USER -d $DB_NAME << SQL
SELECT 
    (SELECT COUNT(*) FROM bedrifter WHERE search_vector IS NOT NULL) as populated,
    (SELECT COUNT(*) FROM bedrifter) as total;
SQL

echo ""
echo "✅ Full-Text Search migration completed!"
