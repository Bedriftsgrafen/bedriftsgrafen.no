import asyncio
import os
import sys
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Add backend to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

# Load environment variables manually
from dotenv import load_dotenv
load_dotenv()

async def verify_indices():
    db_user = os.getenv("DATABASE_USER", "admin")
    db_password = os.getenv("DATABASE_PASSWORD", "")
    db_host = os.getenv("DATABASE_HOST", "localhost")
    db_port = os.getenv("DATABASE_PORT", "5432")
    db_name = os.getenv("DATABASE_NAME", "bedriftsgrafen")
    
    # Use localhost for local verification
    if db_host == "bedriftsgrafen-db":
        db_host = "localhost"

    url = f"postgresql+asyncpg://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    engine = create_async_engine(url)

    # Sample bounding box (Oslo area approx)
    west, south, east, north = 10.5, 59.8, 10.9, 60.0

    query = text(f"""
        EXPLAIN (ANALYZE, BUFFERS)
        SELECT orgnr, navn, latitude, longitude, naeringskode, antall_ansatte
        FROM bedrifter
        WHERE latitude >= {south} AND latitude <= {north}
          AND longitude >= {west} AND longitude <= {east}
        LIMIT 5000;
    """)

    async with engine.connect() as conn:
        result = await conn.execute(query)
        for row in result:
            print(row[0])

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(verify_indices())
