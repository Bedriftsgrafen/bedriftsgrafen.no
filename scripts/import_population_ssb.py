#!/usr/bin/env python3
"""
Import Population Statistics from SSB (Table 07459)
"""

import asyncio
import logging
import sys
from datetime import datetime

import httpx
from sqlalchemy.dialects.postgresql import insert as pg_insert

# Add parent directory to path
sys.path.insert(0, "/app")

from database import AsyncSessionLocal
from models import MunicipalityPopulation

# Configure Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

SSB_API_URL = "https://data.ssb.no/api/v0/no/table/06913"

async def fetch_ssb_data():
    """Fetch population details from SSB"""
    # Query for "Folkemengde" (contentsCode: Folkemengde) for all municipalities (Region: *)
    # for the latest year available (Tid: top 1).
    payload = {
        "query": [
            {
                "code": "Region",
                "selection": {
                    "filter": "all",
                    "values": ["*"]
                }
            },
            {
                "code": "ContentsCode",
                "selection": {
                    "filter": "item",
                    "values": ["Folkemengde"]
                }
            },
            {
                "code": "Tid",
                "selection": {
                    "filter": "top",
                    "values": ["1"]
                }
            }
        ],
        "response": {
            "format": "json-stat2"
        }
    }

    async with httpx.AsyncClient() as client:
        logger.info("Fetching data from SSB...")
        response = await client.post(SSB_API_URL, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()

async def import_population():
    data = await fetch_ssb_data()

    # JSON-stat2 structure parsing
    # dimensions: Region, Tid
    # value: list of values

    dimension = data["dimension"]
    region_dim = dimension["Region"]
    time_dim = dimension["Tid"]

    regions = list(region_dim["category"]["index"].keys()) # List of commune codes
    years = list(time_dim["category"]["index"].keys()) # List of years (should be 1)
    values = data["value"]

    current_year = int(years[0])
    logger.info(f"Importing population data for year: {current_year}")

    records = []

    # Iterate through regions (municipalities)
    # Since we requested 1 year and 1 content code, the values list matches the region list index 1-to-1
    for i, region_code in enumerate(regions):
        # SSB returns 4-digit codes for municipalities.
        # Filter out counties or other non-municipality regions if necessary (usually they are 2 digits)
        if len(region_code) == 4:
            pop = values[i]
            records.append({
                "municipality_code": region_code,
                "year": current_year,
                "population": int(pop)
            })

    if not records:
        logger.warning("No records found to import.")
        return

    logger.info(f"Found {len(records)} municipality records.")

    async with AsyncSessionLocal() as session:
        # Upsert
        stmt = pg_insert(MunicipalityPopulation).values(records)
        stmt = stmt.on_conflict_do_update(
            index_elements=["municipality_code", "year"],
            set_={"population": stmt.excluded.population, "updated_at": datetime.utcnow()}
        )

        await session.execute(stmt)
        await session.commit()
        logger.info("Database update complete.")

if __name__ == "__main__":
    try:
        asyncio.run(import_population())
    except Exception as e:
        logger.error(f"Import failed: {e}")
        sys.exit(1)
