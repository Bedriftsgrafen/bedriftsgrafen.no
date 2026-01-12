"""
Batched migration script to add Full-Text Search support to the bedrifter table.
Optimized for efficient hardware with large tables.

This script:
1. Adds a tsvector column (search_vector) to bedrifter table
2. Populates it in small batches (1000 rows at a time) with progress updates
3. Creates a trigger to auto-update search_vector on INSERT/UPDATE
4. Creates a GIN index CONCURRENTLY to avoid blocking reads

Usage:
    python -m scripts.add_fulltext_search
"""

import asyncio
import sys
import os
from sqlalchemy import text
from dotenv import load_dotenv

# Add parent directory to path to import database module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def load_environment():
    """Load environment variables from .env file"""
    # scripts/ -> backend/ -> root/
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    env_path = os.path.join(project_root, ".env")

    if os.path.exists(env_path):
        print(f"Loading .env from {env_path}")
        load_dotenv(env_path)
    else:
        print("Warning: .env file not found in project root")

    # Override DATABASE_HOST for local execution if it is set to the docker service name
    if os.getenv("DATABASE_HOST") == "bedriftsgrafen-db":
        print("DATABASE_HOST is set to 'bedriftsgrafen-db'. Overriding to 'localhost' for local script execution.")
        os.environ["DATABASE_HOST"] = "localhost"


async def add_fulltext_search():
    """Add Full-Text Search support to bedrifter table with batching"""

    # Import here to avoid E402
    from database import AsyncSessionLocal, engine

    print("=" * 60)
    print("Full-Text Search Migration (Batched for Efficient Hardware)")
    print("=" * 60)

    async with AsyncSessionLocal() as db:
        try:
            # Step 1: Add search_vector column if it does not exist
            print("\n[1/5] Adding search_vector column...")
            await db.execute(text("ALTER TABLE bedrifter ADD COLUMN IF NOT EXISTS search_vector tsvector;"))
            await db.commit()
            print("✓ Column added/verified")

            # Step 2: Create trigger function
            print("\n[2/5] Creating trigger function...")
            await db.execute(
                text("""
CREATE OR REPLACE FUNCTION bedrifter_search_vector_update()
RETURNS trigger AS $$
BEGIN
    NEW.search_vector :=
        setweight(to_tsvector('norwegian', COALESCE(NEW.navn, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.orgnr, '')), 'B');
    RETURN NEW;
END
$$ LANGUAGE plpgsql;
""")
            )
            await db.commit()
            print("✓ Trigger function created")

            # Step 3: Create trigger
            print("\n[3/5] Creating trigger...")
            await db.execute(
                text("""
DROP TRIGGER IF EXISTS bedrifter_search_vector_trigger ON bedrifter;
CREATE TRIGGER bedrifter_search_vector_trigger
BEFORE INSERT OR UPDATE OF navn, orgnr
ON bedrifter
FOR EACH ROW
EXECUTE FUNCTION bedrifter_search_vector_update();
""")
            )
            await db.commit()
            print("✓ Trigger created")

            # Step 4: Populate search_vector in batches
            print("\n[4/5] Populating search_vector (batched)...")

            # Get total count
            result = await db.execute(
                text("SELECT COUNT(*) FROM bedrifter WHERE search_vector IS NULL OR search_vector = ''::tsvector")
            )
            total = result.scalar()
            print(f"  → Found {total:,} rows to update")

            if total > 0:
                batch_size = 1000
                updated = 0

                while updated < total:
                    result = await db.execute(
                        text("""
UPDATE bedrifter
SET search_vector =
    setweight(to_tsvector('norwegian', COALESCE(navn, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(orgnr, '')), 'B')
WHERE orgnr IN (
    SELECT orgnr FROM bedrifter
    WHERE search_vector IS NULL OR search_vector = ''::tsvector
    LIMIT :batch_size
)
"""),
                        {"batch_size": batch_size},
                    )

                    rows_updated = result.rowcount
                    await db.commit()

                    updated += rows_updated
                    progress = (updated / total) * 100
                    print(f"  → {updated:,}/{total:,} ({progress:.1f}%) - {rows_updated} rows in this batch")

                    if rows_updated == 0:
                        break

                print(f"✓ Updated {updated:,} rows")
            else:
                print("✓ All rows already populated")

        except Exception as e:
            print(f"\n❌ Migration failed: {e}")
            await db.rollback()
            raise

    # Step 5: Create GIN index CONCURRENTLY (outside transaction)
    print("\n[5/5] Creating GIN index (CONCURRENTLY)...")
    print("  → This may take several minutes on efficient hardware...")

    try:
        async with engine.connect() as conn:
            # Drop existing index if any
            await conn.execution_options(isolation_level="AUTOCOMMIT").execute(
                text("DROP INDEX CONCURRENTLY IF EXISTS bedrifter_search_vector_idx;")
            )

        async with engine.connect() as conn:
            # Create new index
            await conn.execution_options(isolation_level="AUTOCOMMIT").execute(
                text("CREATE INDEX CONCURRENTLY bedrifter_search_vector_idx ON bedrifter USING GIN(search_vector);")
            )
        print("✓ GIN index created")

    except Exception as e:
        print(f"⚠ Index creation failed: {e}")
        print("  You can create it manually later with:")
        print("  CREATE INDEX CONCURRENTLY bedrifter_search_vector_idx ON bedrifter USING GIN(search_vector);")

    # Final verification
    print("\n" + "=" * 60)
    print("Verification")
    print("=" * 60)

    async with AsyncSessionLocal() as db:
        # Check column exists
        result = await db.execute(
            text(
                "SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'bedrifter' AND column_name = 'search_vector'"
            )
        )
        col_exists = result.scalar() == 1
        print(f"{'✓' if col_exists else '✗'} Column exists: {col_exists}")

        # Check trigger exists
        result = await db.execute(
            text(
                "SELECT COUNT(*) FROM information_schema.triggers WHERE event_object_table = 'bedrifter' AND trigger_name = 'bedrifter_search_vector_trigger'"
            )
        )
        trigger_exists = result.scalar() == 1
        print(f"{'✓' if trigger_exists else '✗'} Trigger exists: {trigger_exists}")

        # Check index exists
        result = await db.execute(
            text(
                "SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'bedrifter' AND indexname = 'bedrifter_search_vector_idx'"
            )
        )
        idx_exists = result.scalar() == 1
        print(f"{'✓' if idx_exists else '✗'} GIN index exists: {idx_exists}")

        # Count populated rows
        result = await db.execute(
            text("SELECT COUNT(*) FROM bedrifter WHERE search_vector IS NOT NULL AND search_vector != ''::tsvector")
        )
        populated = result.scalar()

        result = await db.execute(text("SELECT COUNT(*) FROM bedrifter"))
        total = result.scalar()

        print(f"✓ Rows populated: {populated:,}/{total:,}")

    print("\n" + "=" * 60)
    print("✅ Migration completed successfully!")
    print("=" * 60)
    print("\nYou can now use Full-Text Search in queries:")
    print("  SELECT * FROM bedrifter")
    print("  WHERE search_vector @@ websearch_to_tsquery('norwegian', 'search term');")


if __name__ == "__main__":
    load_environment()
    asyncio.run(add_fulltext_search())
