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


async def check_indices():
    print(f"Connecting to database: {DATABASE_URL.split('@')[-1]}")  # Mask password
    try:
        engine = create_async_engine(DATABASE_URL)
        async with engine.connect() as conn:
            print("Checking indices on 'bedrifter' table...")
            result = await conn.execute(
                text("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'bedrifter';")
            )
            indices = result.fetchall()

            if not indices:
                print("WARNING: No indices found on 'bedrifter' table!")
            else:
                print(f"Found {len(indices)} indices:")
                found_target_indices = []
                target_indices = [
                    "idx_bedrifter_stiftelsesdato",
                    "idx_bedrifter_konkurs",
                    "idx_bedrifter_antall_ansatte",
                ]

                for idx in indices:
                    print(f" - {idx.indexname}")
                    if idx.indexname in target_indices:
                        found_target_indices.append(idx.indexname)

                missing = set(target_indices) - set(found_target_indices)
                if missing:
                    print(f"\nMISSING INDICES: {', '.join(missing)}")
                    print("Please run scripts/add_company_indices.py")
                else:
                    print("\nAll required indices on 'bedrifter' are present.")

            print("\nChecking indices on 'regnskap' table...")
            result = await conn.execute(
                text("SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'regnskap';")
            )
            indices = result.fetchall()

            if not indices:
                print("WARNING: No indices found on 'regnskap' table!")
            else:
                print(f"Found {len(indices)} indices:")
                found_target_indices = []
                target_indices = [
                    "idx_regnskap_salgsinntekter",
                    "idx_regnskap_aarsresultat",
                    "idx_regnskap_driftsresultat",
                    "idx_regnskap_egenkapital",
                ]

                for idx in indices:
                    print(f" - {idx.indexname}")
                    if idx.indexname in target_indices:
                        found_target_indices.append(idx.indexname)

                missing = set(target_indices) - set(found_target_indices)
                if missing:
                    print(f"\nMISSING INDICES on 'regnskap': {', '.join(missing)}")
                    print("Please run scripts/add_company_indices.py")
                else:
                    print("\nAll required indices on 'regnskap' are present.")

        await engine.dispose()
    except Exception as e:
        print(f"Error connecting to database: {e}")


if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(check_indices())
