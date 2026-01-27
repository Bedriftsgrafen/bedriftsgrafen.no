import asyncio
import logging
import os
import sys
import argparse
from datetime import datetime, timezone
from sqlalchemy import text, delete
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from dotenv import load_dotenv

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), "backend"))

import models

load_dotenv()



# Get connection parameters from environment

db_user = os.environ.get("DATABASE_USER")

db_pass = os.environ.get("DATABASE_PASSWORD")

db_host = os.environ.get("DATABASE_HOST")

db_port = os.environ.get("DATABASE_PORT", "5432")

db_name = os.environ.get("DATABASE_NAME")



if not all([db_user, db_pass, db_host, db_name]):

    logger.error("Missing required database environment variables (USER, PASSWORD, HOST, NAME)")

    sys.exit(1)



# Override for host-based execution

if db_host == "bedriftsgrafen-db":

    db_host = "localhost"



# Reconstruct async URL

SQLALCHEMY_DATABASE_URL = f"postgresql+asyncpg://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"



from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

engine = create_async_engine(SQLALCHEMY_DATABASE_URL)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

async def purge_deleted_companies(dry_run: bool = True, batch_size: int = 1000):
    """
    Purge companies from the 'bedrifter' table that are marked as deleted in their raw data.
    Targets ALL companies with a 'slettedato' field for a clean database.
    """
    async with AsyncSessionLocal() as db:
        if dry_run:
            logger.info("--- DRY RUN MODE ENABLED ---")
        
        logger.info("Identifying all deleted companies to purge...")
        
        # 1. Count them first
        count_stmt = text("""
            SELECT count(*) FROM bedrifter 
            WHERE (data->>'slettedato') IS NOT NULL
        """)
        result = await db.execute(count_stmt)
        total_to_purge = result.scalar() or 0
        
        if total_to_purge == 0:
            logger.info("No deleted companies found to purge. Database is clean!")
            return

        logger.info(f"Found {total_to_purge} total deleted companies.")
        
        if dry_run:
            # Test query logic even in dry run to ensure no syntax errors
            test_batch = await db.execute(text("SELECT orgnr FROM bedrifter WHERE (data->>'slettedato') IS NOT NULL LIMIT 1"))
            test_res = test_batch.fetchall()
            logger.info(f"Verified query logic. Ready to purge {total_to_purge} companies.")
            return

        # 2. Purge in batches using SQLAlchemy delete builder (safer than raw SQL)
        purged_count = 0
        
        while purged_count < total_to_purge:
            # Get next batch of orgnrs
            batch_query = text("""
                SELECT orgnr FROM bedrifter 
                WHERE (data->>'slettedato') IS NOT NULL
                LIMIT :limit
            """)
            result = await db.execute(batch_query, {"limit": batch_size})
            batch_orgnrs = [row[0] for row in result.fetchall()]
            
            if not batch_orgnrs:
                break
            
            # Use SQLAlchemy Delete objects - handles parameter expansion automatically and safely
            
            # Delete roles
            await db.execute(
                delete(models.Role).where(models.Role.orgnr.in_(batch_orgnrs))
            )
            
            # Delete subunits
            await db.execute(
                delete(models.SubUnit).where(models.SubUnit.parent_orgnr.in_(batch_orgnrs))
            )
            
            # Delete accounting
            await db.execute(
                delete(models.Accounting).where(models.Accounting.orgnr.in_(batch_orgnrs))
            )
            
            # Finally delete from main table
            await db.execute(
                delete(models.Company).where(models.Company.orgnr.in_(batch_orgnrs))
            )
            
            await db.commit()
            
            purged_count += len(batch_orgnrs)
            logger.info(f"Purged batch. Total: {purged_count}/{total_to_purge}")

        logger.info(f"Successfully purged {purged_count} deleted companies.")
        
        # 3. Run maintenance
        logger.info("Running maintenance (ANALYZE)...")
        try:
            await db.execute(text("ANALYZE bedrifter"))
            await db.execute(text("ANALYZE roller"))
            await db.commit()
        except Exception as e:
            logger.warning(f"Maintenance warning: {e}")
            
        logger.info("Purge complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Purge deleted companies from database")
    parser.add_argument("--run", action="store_true", help="Actually run the purge")
    parser.add_argument("--batch-size", type=int, default=1000, help="Batch size")
    
    args = parser.parse_args()
    asyncio.run(purge_deleted_companies(dry_run=not args.run, batch_size=args.batch_size))