import asyncio
import os
import sys

from dotenv import load_dotenv
from sqlalchemy import select

# Add parent directory to path to import database module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def load_environment():
    """Load environment variables from .env file"""
    # scripts/ -> backend/ -> root/
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    env_path = os.path.join(project_root, '.env')

    if os.path.exists(env_path):
        print(f"Loading .env from {env_path}")
        load_dotenv(env_path)
    else:
        print("Warning: .env file not found in project root")

    # Override DATABASE_HOST for local execution if it's set to the docker service name
    if os.getenv("DATABASE_HOST") == "bedriftsgrafen-db":
        print("DATABASE_HOST is set to 'bedriftsgrafen-db'. Overriding to 'localhost' for local script execution.")
        os.environ["DATABASE_HOST"] = "localhost"

async def recalculate_kpis():
    """
    Recalculate KPIs for all existing accounting records.
    This is useful after adding new KPI columns to the database schema.
    """
    # Import here to avoid E402 and ensure env vars are loaded
    from database import AsyncSessionLocal
    from models import Accounting

    async with AsyncSessionLocal() as db:
        print("Fetching accounting records...")
        result = await db.execute(select(Accounting))
        records = result.scalars().all()

        print(f"Found {len(records)} records. Recalculating KPIs...")

        updated_count = 0
        for record in records:
            # Calculate Likviditetsgrad 1 (Liquidity Ratio 1)
            # Formula: Current Assets / Current Liabilities
            omloepsmidler = record.omloepsmidler or 0
            kortsiktig_gjeld = record.kortsiktig_gjeld or 0
            if kortsiktig_gjeld > 0:
                record.likviditetsgrad1 = omloepsmidler / kortsiktig_gjeld
            else:
                record.likviditetsgrad1 = None

            # Calculate EBITDA Margin
            # Formula: (Operating Profit + Depreciation) / Revenue
            driftsresultat = record.driftsresultat or 0
            avskrivninger = record.avskrivninger or 0
            salgsinntekter = record.salgsinntekter or 0
            if salgsinntekter > 0:
                ebitda = driftsresultat + avskrivninger
                record.ebitda_margin = ebitda / salgsinntekter
            else:
                record.ebitda_margin = None

            # Calculate Equity Ratio (Egenkapitalandel)
            # Formula: Equity / Total Assets
            egenkapital = record.egenkapital
            anleggsmidler = record.anleggsmidler or 0
            # Total Assets = Fixed Assets + Current Assets
            total_eiendeler = anleggsmidler + omloepsmidler

            if total_eiendeler > 0 and egenkapital is not None:
                record.egenkapitalandel = egenkapital / total_eiendeler
            else:
                record.egenkapitalandel = None

            updated_count += 1

            # Print progress every 1000 records
            if updated_count % 1000 == 0:
                print(f"Processed {updated_count} records...")

        await db.commit()
        print(f"✅ Successfully updated {updated_count} records with new KPIs.")

if __name__ == "__main__":
    load_environment()
    asyncio.run(recalculate_kpis())
