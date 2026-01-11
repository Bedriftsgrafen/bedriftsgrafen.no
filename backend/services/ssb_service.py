"""Service for fetching and storing data from Statistics Norway (SSB)."""
import logging
import re
from datetime import datetime

import httpx
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

import models

logger = logging.getLogger(__name__)

# SSB PxWeb API configuration
SSB_API_BASE = "https://data.ssb.no/api/v0/no/table"
SSB_POPULATION_TABLE = "07459"  # Population by municipality
SSB_REQUEST_TIMEOUT = 60.0  # seconds

# Validation pattern for municipality codes (4 digits)
MUNICIPALITY_CODE_PATTERN = re.compile(r"^\d{4}$")

# Query for population by municipality (all municipalities, current year)
# This is a JSON-STAT query format for the PxWeb API.
# We select Folkemengde (population), all Kommuner (municipalities), and the latest year.
SSB_POPULATION_QUERY = {
    "query": [
        {"code": "Region", "selection": {"filter": "all", "values": ["*"]}},
        {"code": "Tid", "selection": {"filter": "top", "values": ["1"]}},  # Latest year
    ],
    "response": {"format": "json-stat2"},
}


class SsbService:
    """Service for SSB data integration."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def fetch_and_store_population(self) -> dict:
        """
        Fetch municipality population from SSB and store in database.

        Returns:
            Dictionary with result summary (inserted count, year, etc.)
        """
        logger.info("Starting SSB population data fetch...")

        # 1. Fetch data from SSB
        url = f"{SSB_API_BASE}/{SSB_POPULATION_TABLE}"
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(url, json=SSB_POPULATION_QUERY)
                response.raise_for_status()
                data = response.json()
        except httpx.HTTPStatusError as e:
            logger.error(
                "SSB API request failed",
                extra={"status_code": e.response.status_code, "url": url}
            )
            raise RuntimeError(f"SSB API request failed: {e.response.status_code}")
        except httpx.TimeoutException:
            logger.error("SSB API request timed out", extra={"timeout": SSB_REQUEST_TIMEOUT})
            raise RuntimeError(f"SSB API request timed out after {SSB_REQUEST_TIMEOUT}s")
        except Exception as e:
            logger.error(f"Failed to fetch SSB data: {e}")
            raise

        # 2. Parse JSON-STAT2 response
        parsed = self._parse_json_stat2(data)
        if not parsed:
            raise RuntimeError("Failed to parse SSB response")

        year, population_data = parsed
        logger.info(f"Parsed {len(population_data)} municipalities for year {year}")

        # 3. Upsert into database (batch operation)
        inserted_count = await self._upsert_population(year, population_data)

        logger.info(f"Successfully synced {inserted_count} municipality populations for year {year}")
        return {
            "status": "success",
            "year": year,
            "municipality_count": inserted_count,
            "synced_at": datetime.now().isoformat(),
        }

    def _parse_json_stat2(self, data: dict) -> tuple[int, dict[str, int]] | None:
        """
        Parse JSON-STAT2 response from SSB.

        Returns:
            Tuple of (year, {municipality_code: population})
        """
        try:
            # Get dimension info
            dimensions = data.get("dimension", {})
            region_dim = dimensions.get("Region", {})
            time_dim = dimensions.get("Tid", {})

            # Get category labels (municipality codes -> indices)
            region_categories = region_dim.get("category", {})
            region_index = region_categories.get("index", {})  # code -> index

            # Get time category (year)
            time_categories = time_dim.get("category", {})
            time_index = time_categories.get("index", {})
            years = list(time_index.keys())
            if not years:
                logger.error("No year found in SSB response")
                return None
            year = int(years[0])

            # Get values array
            values = data.get("value", [])
            if not values:
                logger.error("No values in SSB response")
                return None

            # Build population map
            # JSON-STAT2 values are ordered by dimension order (Region first, Tid second)
            # Since we only have 1 time point, values[i] = population for region[i]
            population_data: dict[str, int] = {}

            for code, idx in region_index.items():
                # SSB uses K-codes like "K0301" for municipalities, we want "0301"
                clean_code = code.replace("K", "").strip()

                # Validate municipality code format (4 digits)
                if not MUNICIPALITY_CODE_PATTERN.match(clean_code):
                    continue

                if idx < len(values) and values[idx] is not None:
                    population_data[clean_code] = int(values[idx])

            return year, population_data

        except Exception as e:
            logger.error(f"Error parsing SSB JSON-STAT2: {e}")
            return None

    async def _upsert_population(self, year: int, population_data: dict[str, int]) -> int:
        """
        Upsert population data into database using PostgreSQL ON CONFLICT.

        Args:
            year: The year for the data
            population_data: Dict of municipality_code -> population

        Returns:
            Number of rows affected
        """
        if not population_data:
            return 0

        # Build list of dicts for bulk upsert
        rows = [
            {"municipality_code": code, "year": year, "population": pop}
            for code, pop in population_data.items()
        ]

        # Use PostgreSQL INSERT ... ON CONFLICT DO UPDATE (upsert)
        stmt = insert(models.MunicipalityPopulation).values(rows)
        stmt = stmt.on_conflict_do_update(
            index_elements=["municipality_code", "year"],
            set_={"population": stmt.excluded.population, "updated_at": datetime.now()},
        )

        await self.db.execute(stmt)
        await self.db.commit()

        return len(rows)
