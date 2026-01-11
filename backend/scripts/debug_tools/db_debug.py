
import asyncio

from sqlalchemy import text

from database import AsyncSessionLocal


async def debug_db():
    async with AsyncSessionLocal() as db:
        print("--- DB DEBUG ---")

        # Check current DB and User
        res = await db.execute(text("SELECT current_database(), current_user, current_schema()"))
        print("Session info:", res.fetchone())

        # Check tables
        res = await db.execute(text("SELECT schemaname, tablename FROM pg_tables WHERE tablename = 'companies'"))
        print("Companies table:", res.fetchall())

        # Try count
        try:
            res = await db.execute(text("SELECT count(*) FROM companies"))
            print("Row count:", res.scalar())
        except Exception as e:
            print("Count failed:", e)

if __name__ == "__main__":
    asyncio.run(debug_db())
