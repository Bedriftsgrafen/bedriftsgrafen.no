
import asyncio
import logging
from sqlalchemy import text
from database import AsyncSessionLocal

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def fix_null_parents():
    async with AsyncSessionLocal() as session:
        # Check for nulls
        res = await session.execute(text("SELECT count(*) FROM underenheter WHERE parent_orgnr IS NULL"))
        null_count = res.scalar()
        logger.info(f"Found {null_count} rows with NULL parent_orgnr in 'underenheter'")
        
        if null_count > 0:
            logger.info("Deleting rows with NULL parent_orgnr to maintain integrity...")
            await session.execute(text("DELETE FROM underenheter WHERE parent_orgnr IS NULL"))
            await session.commit()
            logger.info("Deletion complete.")
        else:
            logger.info("No action needed.")

if __name__ == "__main__":
    asyncio.run(fix_null_parents())
