"""
Add Full Text Search to bedrifter table

This script adds a tsvector column and GIN index for fast full-text search
on company names and organization numbers.

Run with: python scripts/add_fulltext_search.py
Or execute the SQL directly in psql.
"""

ADD_SEARCH_VECTOR_SQL = """
-- Step 1: Add search_vector column
ALTER TABLE bedrifter
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Step 2: Generate search vector from navn and orgnr
-- Use Norwegian language configuration for better stemming
UPDATE bedrifter
SET search_vector =
    setweight(to_tsvector('norwegian', coalesce(navn, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(orgnr, '')), 'B');

-- Step 3: Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_bedrifter_search_vector
ON bedrifter USING GIN(search_vector);

-- Step 4: Create trigger to auto-update search_vector on INSERT/UPDATE
CREATE OR REPLACE FUNCTION bedrifter_search_vector_update()
RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('norwegian', coalesce(NEW.navn, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.orgnr, '')), 'B');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bedrifter_search_vector_trigger ON bedrifter;
CREATE TRIGGER bedrifter_search_vector_trigger
BEFORE INSERT OR UPDATE ON bedrifter
FOR EACH ROW EXECUTE FUNCTION bedrifter_search_vector_update();

-- Analyze table for better query planning
ANALYZE bedrifter;
"""

ROLLBACK_SQL = """
-- Rollback script if needed
DROP TRIGGER IF EXISTS bedrifter_search_vector_trigger ON bedrifter;
DROP FUNCTION IF EXISTS bedrifter_search_vector_update();
DROP INDEX IF EXISTS idx_bedrifter_search_vector;
ALTER TABLE bedrifter DROP COLUMN IF EXISTS search_vector;
"""


async def run_migration(db_url: str):
    """
    Run the migration using asyncpg
    """
    import asyncpg

    conn = await asyncpg.connect(db_url)
    try:
        print("Adding search_vector column and index...")
        await conn.execute(ADD_SEARCH_VECTOR_SQL)
        print("✓ Full-text search migration completed successfully!")

        # Check results
        count = await conn.fetchval("SELECT COUNT(*) FROM bedrifter WHERE search_vector IS NOT NULL")
        print(f"✓ {count} companies have search_vector populated")

    finally:
        await conn.close()


if __name__ == "__main__":
    import asyncio
    import os
    import sys

    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

    try:
        from dotenv import load_dotenv

        load_dotenv()
    except ImportError:
        pass

    # Build connection string
    db_user = os.getenv("DATABASE_USER", "postgres")
    db_pass = os.getenv("DATABASE_PASSWORD", "postgres")
    db_name = os.getenv("DATABASE_NAME", "bedriftsgrafen")
    db_host = os.getenv("DATABASE_HOST", "localhost")

    db_url = f"postgresql://{db_user}:{db_pass}@{db_host}:5432/{db_name}"

    print("Running Full-Text Search migration...")
    print(f"Database: {db_name}@{db_host}")
    print()

    asyncio.run(run_migration(db_url))

    print()
    print("You can also run this SQL manually:")
    print("=" * 60)
    print(ADD_SEARCH_VECTOR_SQL)
