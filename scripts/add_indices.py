import asyncio
import os
import sys

# Add parent directory to path to import database module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import engine  # noqa: E402


# Manually load .env from project root
def load_env():
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    env_path = os.path.join(root_dir, ".env")
    print(f"Loading .env from {env_path}")

    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    # Only set if not already set (to respect container envs if any)
                    if key not in os.environ:
                        os.environ[key] = value.strip('"').strip("'")
    else:
        print("Warning: .env file not found")


# Logic to setup environment
if not os.getenv("DATABASE_HOST"):
    load_env()
    # If still not set (e.g. running locally without env vars pre-set), default to localhost
    if not os.getenv("DATABASE_HOST") or os.getenv("DATABASE_HOST") == "bedriftsgrafen-db":
        print("Overriding DATABASE_HOST to localhost for local script execution")
        os.environ["DATABASE_HOST"] = "localhost"


async def add_indices():
    print("Adding indices to database...")

    indices = [
        # Company table indices
        "CREATE INDEX IF NOT EXISTS idx_bedrifter_naeringskode ON bedrifter (naeringskode);",
        "CREATE INDEX IF NOT EXISTS idx_bedrifter_antall_ansatte ON bedrifter (antall_ansatte);",
        "CREATE INDEX IF NOT EXISTS idx_bedrifter_stiftelsesdato ON bedrifter (stiftelsesdato);",
        "CREATE INDEX IF NOT EXISTS idx_bedrifter_konkurs ON bedrifter (konkurs);",
        "CREATE INDEX IF NOT EXISTS idx_bedrifter_under_avvikling ON bedrifter (under_avvikling);",
        "CREATE INDEX IF NOT EXISTS idx_bedrifter_under_tvangsavvikling ON bedrifter (under_tvangsavvikling);",
        # Accounting table indices
        "CREATE INDEX IF NOT EXISTS idx_regnskap_salgsinntekter ON regnskap (salgsinntekter);",
        "CREATE INDEX IF NOT EXISTS idx_regnskap_aarsresultat ON regnskap (aarsresultat);",
        "CREATE INDEX IF NOT EXISTS idx_regnskap_egenkapital ON regnskap (egenkapital);",
        "CREATE INDEX IF NOT EXISTS idx_regnskap_driftsresultat ON regnskap (driftsresultat);",
        # Indices for computed columns (persisted)
        "CREATE INDEX IF NOT EXISTS idx_regnskap_likviditetsgrad ON regnskap (likviditetsgrad1);",
        "CREATE INDEX IF NOT EXISTS idx_regnskap_egenkapitalandel ON regnskap (egenkapitalandel);",
    ]

    # Use connect() instead of begin() to manage transactions manually
    async with engine.connect() as conn:
        # Increase statement timeout to 5 minutes (300000 ms) for this session
        # The default is 5000 ms which is too short for index creation on RPi
        print("Setting statement timeout to 5 minutes...")
        await conn.execute(text("SET statement_timeout = '300000'"))
        await conn.commit()

        for index_sql in indices:
            try:
                print(f"Executing: {index_sql}")
                await conn.execute(text(index_sql))
                await conn.commit()
                print("Success.")
            except Exception as e:
                print(f"Error creating index: {e}")
                # Rollback the failed transaction so we can continue with the next index
                await conn.rollback()

    print("Finished adding indices.")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(add_indices())
