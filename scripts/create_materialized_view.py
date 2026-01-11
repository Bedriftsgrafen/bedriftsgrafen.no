import asyncio
import os
import sys

from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Add parent directory to path to import backend modules
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is not set. Provide it via environment variables or a local .env (gitignored).")

if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")


async def create_materialized_view():
    print("Connecting to database...")
    engine = create_async_engine(DATABASE_URL, echo=True)

    async with engine.begin() as conn:
        print("Creating materialized view 'latest_accountings'...")

        # Drop if exists to ensure clean state
        await conn.execute(text("DROP MATERIALIZED VIEW IF EXISTS latest_accountings;"))

        # Create the view
        # We select the distinct accounting record for each orgnr, ordered by year descending
        query = """
        CREATE MATERIALIZED VIEW latest_accountings AS
        SELECT DISTINCT ON (orgnr)
            orgnr,
            aar,
            salgsinntekter,
            aarsresultat,
            driftsresultat,
            total_inntekt,
            avskrivninger
        FROM regnskap
        ORDER BY orgnr, aar DESC;
        """
        await conn.execute(text(query))

        print("Creating index on 'latest_accountings'...")
        await conn.execute(text("CREATE UNIQUE INDEX idx_latest_accountings_orgnr ON latest_accountings (orgnr);"))

        print("Materialized view created successfully.")

    await engine.dispose()


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

    asyncio.run(create_materialized_view())
