import asyncio
import logging
import os
import sys
from datetime import datetime
from pathlib import Path

import psycopg2
from psycopg2.extras import execute_values

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from services.brreg_api_service import BrregApiService  # noqa: E402
from services.brreg_egress_guard import brreg_traffic_class  # noqa: E402

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)

# Configuration
DB_HOST = os.getenv("DATABASE_HOST")
DB_NAME = os.getenv("DATABASE_NAME")
DB_USER = os.getenv("DATABASE_USER")
DB_PASSWORD = os.getenv("DATABASE_PASSWORD")

if not DB_USER or not DB_PASSWORD:
    raise RuntimeError(
        "DATABASE_USER and DATABASE_PASSWORD must be set in environment. See .env.example for configuration."
    )


def get_db_connection():
    return psycopg2.connect(
        host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASSWORD
    )


def create_regnskap_table(conn):
    with conn.cursor() as cur:
        logger.info("Creating/updating 'regnskap' table...")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS regnskap (
                id SERIAL PRIMARY KEY,
                orgnr VARCHAR(20) NOT NULL,
                aar INTEGER NOT NULL,
                total_inntekt NUMERIC,
                aarsresultat NUMERIC,
                egenkapital NUMERIC,
                gjeldsgrad NUMERIC,
                valuta VARCHAR(10),
                avslutningsdato DATE,
                UNIQUE(orgnr, aar)
            );
            CREATE INDEX IF NOT EXISTS idx_regnskap_orgnr ON regnskap(orgnr);
        """)
        conn.commit()


async def fetch_accounting_data(brreg_api: BrregApiService, orgnr: str, year: int):
    """Fetch through the shared fail-closed Redis egress guard."""
    try:
        return await brreg_api.fetch_financial_statements(orgnr, year)
    except Exception as e:
        logger.error(f"Request failed for {orgnr}: {e}")
        return None


def parse_accounting_data(api_data):
    """Extract relevant fields from the complex API response."""
    # The API returns a list, usually we want the latest approved one ("regnskapstype": "SELSKAP")
    # This is a simplified parser. You might need to adjust based on specific needs.

    results = []
    for entry in api_data:
        try:
            # Basic info
            orgnr = entry.get("virksomhet", {}).get("organisasjonsnummer")
            aar = entry.get("regnskapsperiode", {}).get("fraDato", "")[:4]

            if not orgnr or not aar:
                continue

            # Financials are deeply nested.
            # Example path: resultatrekning -> resultat -> aarsresultat
            # Note: The structure varies by accounting type (store, small, etc.)

            # Try to find common fields. This requires inspection of actual API responses.
            # For now, we will look for 'egenkapitalGjeld' and 'resultatregnskap'

            egenkapital = (
                entry.get("egenkapitalGjeld", {})
                .get("egenkapital", {})
                .get("sumEgenkapital")
            )

            # Income (Driftsinntekter)
            inntekt = (
                entry.get("resultatregnskap", {})
                .get("driftsinntekter", {})
                .get("sumDriftsinntekter")
            )

            # Result (Årsresultat)
            resultat = (
                entry.get("resultatregnskap", {})
                .get("aarsresultat", {})
                .get("aarsresultat")
            )

            til_dato = entry.get("regnskapsperiode", {}).get("tilDato")
            results.append(
                (
                    orgnr,
                    int(aar),
                    inntekt,
                    resultat,
                    egenkapital,
                    0.0,  # Gjeldsgrad placeholder
                    entry.get("valuta", "NOK"),
                    til_dato,  # avslutningsdato
                    til_dato,  # periode_til (for unique constraint)
                )
            )
        except Exception as e:
            logger.error(f"Error parsing entry for {orgnr}: {e}")
            continue

    return results


async def process_companies():
    os.environ.setdefault("BRREG_EGRESS_TRAFFIC_CLASS", "background")
    conn = get_db_connection()
    create_regnskap_table(conn)
    brreg_api = BrregApiService()
    logger.info(
        "Brreg imports use the shared egress guard (%s traffic)", brreg_traffic_class()
    )

    try:
        with conn.cursor() as cur:
            # Get list of AS companies (Aksjeselskap) to prioritize
            logger.info("Fetching list of AS companies from DB...")
            # Note: Adjust the WHERE clause based on your actual 'bedrifter' table structure
            # Assuming 'organisasjonsform' is stored in the JSON 'data' column or a separate column
            cur.execute(
                "SELECT orgnr FROM bedrifter WHERE navn LIKE '% AS' LIMIT 100"
            )  # Start small for testing
            companies = cur.fetchall()

            logger.info(f"Found {len(companies)} companies to process.")

            for (orgnr,) in companies:
                logger.info(f"Processing {orgnr}...")

                # Fetch last 3 years
                current_year = datetime.now().year
                for year in range(current_year - 3, current_year):
                    raw_data = await fetch_accounting_data(brreg_api, orgnr, year)
                    if raw_data:
                        parsed_rows = parse_accounting_data(raw_data)

                        if parsed_rows:
                            query = """
                                INSERT INTO regnskap (orgnr, aar, total_inntekt, aarsresultat, egenkapital, gjeldsgrad, valuta, avslutningsdato, periode_til)
                                VALUES %s
                                ON CONFLICT ON CONSTRAINT regnskap_orgnr_periode_unique DO UPDATE SET
                                    total_inntekt = EXCLUDED.total_inntekt,
                                    aarsresultat = EXCLUDED.aarsresultat,
                                    egenkapital = EXCLUDED.egenkapital,
                                    avslutningsdato = EXCLUDED.avslutningsdato;
                            """
                            execute_values(cur, query, parsed_rows)
                            conn.commit()
                            logger.info(f"Saved data for {orgnr} - {year}")

    except Exception as e:
        logger.error(f"Script failed: {e}")
    finally:
        conn.close()


if __name__ == "__main__":
    asyncio.run(process_companies())
