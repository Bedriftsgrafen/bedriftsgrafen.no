import asyncio
from sqlalchemy import select, func
from database import AsyncSessionLocal
import models

async def main():
    async with AsyncSessionLocal() as session:
        # Replicate the query from StatsRepository.get_municipality_names
        query = select(
            models.Company.forretningsadresse["kommunenummer"].astext.label("code"),
            models.Company.forretningsadresse["kommune"].astext.label("name"),
        ).where(models.Company.forretningsadresse["kommunenummer"].isnot(None)).distinct()
        
        result = await session.execute(query)
        rows = result.all()
        print(f"Total rows: {len(rows)}")
        
        # Check for duplicates or extra codes
        codes = {}
        for row in rows:
            code = str(row.code).strip()
            name = str(row.name).strip()
            if code in codes:
                codes[code].append(name)
            else:
                codes[code] = [name]
        
        print("\nCodes with multiple names:")
        multi_codes = 0
        for code, names in codes.items():
            if len(names) > 1:
                print(f"{code}: {names}")
                multi_codes += 1
        
        print(f"\nUnique codes: {len(codes)}")
        print(f"Codes with multi-names: {multi_codes}")

if __name__ == "__main__":
    asyncio.run(main())
