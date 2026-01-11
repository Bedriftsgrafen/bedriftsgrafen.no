import json
import logging
import os
import sys
import time
from decimal import Decimal

import ijson
import psycopg2
from psycopg2.extras import execute_values

# Konfigurasjon
# Setup logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s", handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

# Bruk absolutt sti basert på hvor skriptet ligger
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
JSON_FILE = os.path.join(PROJECT_ROOT, "enheter_alle.json")
BATCH_SIZE = 1000  # Redusert batch-størrelse for å spare minne på Pi


# Database-tilkobling (Henter fra miljøvariabler som Docker setter)
def get_db_connection():
    return psycopg2.connect(
        host=os.environ.get("DATABASE_HOST"),
        database=os.environ.get("DATABASE_NAME"),
        user=os.environ.get("DATABASE_USER"),
        password=os.environ.get("DATABASE_PASSWORD"),
    )


def create_table(conn):
    with conn.cursor() as cur:
        print("Oppretter tabell 'bedrifter' hvis den ikke finnes...")
        # Vi oppdaterer skjemaet til å matche backend/models.py
        # OBS: Vi dropper IKKE tabellen for å bevare regnskapsdata!
        cur.execute("""
            CREATE TABLE IF NOT EXISTS bedrifter (
                orgnr VARCHAR(20) PRIMARY KEY,
                navn TEXT,
                organisasjonsform VARCHAR(10),
                organisasjonsform_beskrivelse TEXT,
                naeringskode VARCHAR(10),
                naeringskode_beskrivelse TEXT,
                antall_ansatte INTEGER,
                hjemmeside TEXT,
                registreringsdato_enhetsregisteret DATE,
                stiftelsesdato DATE,
                konkurs BOOLEAN,
                under_avvikling BOOLEAN,
                under_tvangsavvikling BOOLEAN,
                maalform VARCHAR(20),
                postadresse_adresse TEXT,
                postadresse_postnummer VARCHAR(10),
                postadresse_poststed VARCHAR(50),
                postadresse_kommune VARCHAR(50),
                postadresse_landkode VARCHAR(5),
                forretningsadresse_adresse TEXT,
                forretningsadresse_postnummer VARCHAR(10),
                forretningsadresse_poststed VARCHAR(50),
                forretningsadresse_kommune VARCHAR(50),
                forretningsadresse_landkode VARCHAR(5),
                institusjonell_sektorkode VARCHAR(10),
                institusjonell_sektorkode_beskrivelse TEXT,
                siste_innsendte_aarsregnskap INTEGER,
                data JSONB,
                last_polled_regnskap DATE,
                search_vector TSVECTOR
            );

            -- Indekser opprettes hvis de mangler
            CREATE INDEX IF NOT EXISTS idx_bedrifter_navn ON bedrifter (navn);
            CREATE INDEX IF NOT EXISTS idx_bedrifter_naeringskode ON bedrifter (naeringskode);
            CREATE INDEX IF NOT EXISTS idx_bedrifter_postnummer ON bedrifter (forretningsadresse_postnummer);
            CREATE INDEX IF NOT EXISTS idx_bedrifter_data ON bedrifter USING GIN (data);
            CREATE INDEX IF NOT EXISTS idx_bedrifter_last_polled_regnskap ON bedrifter (last_polled_regnskap);
            CREATE INDEX IF NOT EXISTS idx_bedrifter_search_vector ON bedrifter USING GIN (search_vector);
        """)
        conn.commit()


def json_serial(obj):
    """JSON serializer for objects not serializable by default json code"""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError("Type not serializable")


def import_data():
    start_time = time.time()

    # Sjekk om filen finnes
    if not os.path.exists(JSON_FILE):
        logger.error(f"FEIL: Finner ikke filen '{JSON_FILE}'. Husk å legge den i mappen!")
        return

    try:
        conn = get_db_connection()
        create_table(conn)

        logger.info(f"Starter import fra {JSON_FILE}. Dette kan ta litt tid...")

        # Sjekk filstørrelse for debugging
        file_size = os.path.getsize(JSON_FILE)
        logger.info(f"Filstørrelse: {file_size / (1024 * 1024):.2f} MB")

        count = 0
        batch = []

        with open(JSON_FILE, "rb") as f:
            # ijson.items strømmer objekter ett for ett uten å laste hele filen
            # Hvis filen er en liste av objekter, bruk 'item'
            try:
                # use_float=True gjør at tall parses som float i stedet for Decimal (raskere og unngår JSON-feil)
                objects = ijson.items(f, "item", use_float=True)

                with conn.cursor() as cur:
                    for i, bedrift in enumerate(objects):
                        if i == 0:
                            logger.info("Fant første element i JSON-strømmen. Prosessering i gang...")

                        if i % 1000 == 0 and i > 0:
                            logger.info(f"Lest {i} bedrifter fra fil...")
                            sys.stdout.flush()

                        # Forbered data for innsetting
                        orgnr = bedrift.get("organisasjonsnummer")
                        navn = bedrift.get("navn")

                        # Hent ut ekstra felter som modellen krever
                        org_form = bedrift.get("organisasjonsform", {}).get("kode")
                        naeringskode = bedrift.get("naeringskode1", {}).get("kode")

                        if not orgnr:
                            continue

                        # Legg til i batch (orgnr, navn, org_form, naeringskode, hele json-objektet)
                        # Vi dumper JSON manuelt til streng for ytelse og sikkerhet
                        batch.append((orgnr, navn, org_form, naeringskode, json.dumps(bedrift)))

                        # Når batchen er full, sett inn i DB
                        if len(batch) >= BATCH_SIZE:
                            insert_batch(cur, batch)
                            conn.commit()
                            count += len(batch)
                            logger.info(f"Importert {count} bedrifter... ({time.time() - start_time:.1f}s)")
                            batch = []  # Tøm batch

                    # Sett inn resten (siste rest av batchen)
                    if batch:
                        insert_batch(cur, batch)
                        conn.commit()
                        count += len(batch)
            except Exception as e:
                logger.error(f"Feil under lesing av JSON-strøm: {e}")
                raise

        conn.close()
        logger.info(f"Ferdig! Totalt {count} bedrifter importert på {time.time() - start_time:.1f} sekunder.")

    except Exception as e:
        logger.error(f"En kritisk feil oppstod: {e}", exc_info=True)
        if "conn" in locals() and conn:
            conn.close()


def insert_batch(cur, batch):
    query = """
        INSERT INTO bedrifter (orgnr, navn, organisasjonsform, naeringskode, data)
        VALUES %s
        ON CONFLICT (orgnr) DO UPDATE
        SET navn = EXCLUDED.navn,
            organisasjonsform = EXCLUDED.organisasjonsform,
            naeringskode = EXCLUDED.naeringskode,
            data = EXCLUDED.data;
    """
    execute_values(cur, query, batch)


if __name__ == "__main__":
    import_data()
