
import asyncio
from sqlalchemy import text
from database import AsyncSessionLocal

async def check_schema():
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'bedrifter'"))
        columns = [row[0] for row in res.fetchall()]
        print("Columns in 'bedrifter':")
        for col in sorted(columns):
            print(f" - {col}")

if __name__ == "__main__":
    asyncio.run(check_schema())
