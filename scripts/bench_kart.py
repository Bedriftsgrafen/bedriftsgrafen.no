import asyncio
import os
import sys
import time
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Add backend to sys.path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from dotenv import load_dotenv
load_dotenv()

async def benchmark():
    db_user = os.getenv("DATABASE_USER", "admin")
    db_password = os.getenv("DATABASE_PASSWORD", "")
    db_host = os.getenv("DATABASE_HOST", "localhost")
    db_port = os.getenv("DATABASE_PORT", "5432")
    db_name = os.getenv("DATABASE_NAME", "bedriftsgrafen")
    
    if db_host == "bedriftsgrafen-db":
        db_host = "localhost"

    url = f"postgresql+asyncpg://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}"
    engine = create_async_engine(url)

    scenarios = [
        ("Markers (Oslo BBox)", """
            SELECT orgnr, navn, latitude, longitude, naeringskode, antall_ansatte
            FROM bedrifter
            WHERE latitude >= 59.8 AND latitude <= 60.0
              AND longitude >= 10.5 AND longitude <= 10.9
            LIMIT 5001;
        """),
        ("Markers (Whole Norway - NACE 62)", """
            SELECT orgnr, navn, latitude, longitude, naeringskode, antall_ansatte
            FROM bedrifter
            WHERE naeringskode LIKE '62%'
              AND latitude IS NOT NULL
            LIMIT 5001;
        """),
    ]

    async with engine.connect() as conn:
        for name, sql in scenarios:
            # Warm up
            await conn.execute(text(sql))
            
            start = time.time()
            result = await conn.execute(text(sql))
            rows = result.all()
            end = time.time()
            print(f"{name}: {len(rows)} rows in {(end-start)*1000:.2f}ms")

    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(benchmark())
