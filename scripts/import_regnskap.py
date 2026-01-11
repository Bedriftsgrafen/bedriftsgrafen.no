import logging
import os
import sys
import time
from datetime import datetime

import psycopg2
import requests
from psycopg2.extras import execute_values

# Setup logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s", handlers=[logging.StreamHandler(sys.stdout)]
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

# Brønnøysundregistrene API
API_URL = "https://data.brreg.no/regnskapsregisteret/regnskap"


def get_db_connection():
    return psycopg2.connect(host=DB_HOST, database=DB_NAME, user=DB_USER, password=DB_PASSWORD)


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


def fetch_accounting_data(orgnr, year):
    """Fetch accounting data for a specific company and year."""
    params = {"orgnr": orgnr, "år": year}
    try:
        response = requests.get(API_URL, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data:
                return data
        elif response.status_code == 404:
            return None  # No data found
        else:
            logger.warning(f"API Error {response.status_code} for {orgnr}: {response.text}")
            return None
    except Exception as e:
        logger.error(f"Request failed for {orgnr}: {e}")
        return None
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

            egenkapital = entry.get("egenkapitalGjeld", {}).get("egenkapital", {}).get("sumEgenkapital")

            # Income (Driftsinntekter)
            inntekt = entry.get("resultatregnskap", {}).get("driftsinntekter", {}).get("sumDriftsinntekter")

            # Result (Årsresultat)
            resultat = entry.get("resultatregnskap", {}).get("aarsresultat", {}).get("aarsresultat")

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


def process_companies():
    conn = get_db_connection()
    create_regnskap_table(conn)

    try:
        with conn.cursor() as cur:
            # Get list of AS companies (Aksjeselskap) to prioritize
            logger.info("Fetching list of AS companies from DB...")
            # Note: Adjust the WHERE clause based on your actual 'bedrifter' table structure
            # Assuming 'organisasjonsform' is stored in the JSON 'data' column or a separate column
            cur.execute("SELECT orgnr FROM bedrifter WHERE navn LIKE '% AS' LIMIT 100")  # Start small for testing
            companies = cur.fetchall()

            logger.info(f"Found {len(companies)} companies to process.")

            for (orgnr,) in companies:
                logger.info(f"Processing {orgnr}...")

                # Fetch last 3 years
                current_year = datetime.now().year
                for year in range(current_year - 3, current_year):
                    raw_data = fetch_accounting_data(orgnr, year)
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

                    time.sleep(0.1)  # Be nice to the API

    except Exception as e:
        logger.error(f"Script failed: {e}")
    finally:
        conn.close()


if __name__ == "__main__":
    # Wait for DB to be ready
    time.sleep(5)
    process_companies()
