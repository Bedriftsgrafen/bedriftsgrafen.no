import sys
import asyncio
from sqlalchemy import select

# Add backend directory to path
sys.path.insert(0, "/app")

from database import AsyncSessionLocal
from models import Company


async def main():
    async with AsyncSessionLocal() as db:
        # Get one bankrupt and one active company
        stmt = select(Company).limit(5)
        result = await db.execute(stmt)
        companies = result.scalars().all()

        for company in companies:
            print(f"\n--- Company: {company.navn} ({company.orgnr}) ---")
            if company.raw_data:
                # Print all top-level keys and interesting sub-fields
                for key, value in company.raw_data.items():
                    if isinstance(value, dict):
                        print(f"{key}: <dict with keys: {list(value.keys())}>")
                    else:
                        print(f"{key}: {value}")
            else:
                print("No data.")


if __name__ == "__main__":
    asyncio.run(main())
