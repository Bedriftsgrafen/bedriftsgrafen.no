"""
Pytest configuration and shared fixtures for backend tests.
"""

import sys
from pathlib import Path

import pytest
from dotenv import load_dotenv

# Load env vars before importing anything else
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)

# Add backend to Python path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

# SQLite Compatibility: Map JSONB and TSVECTOR to JSON/Text for in-memory testing
from sqlalchemy.dialects import postgresql as pg  # noqa: E402
from sqlalchemy import JSON, Text  # noqa: E402

# SQLite Compatibility: Map JSONB and TSVECTOR for in-memory testing

# Direct mapping often works better for basic rendering
pg.JSONB = JSON  # type: ignore[misc, assignment]
pg.TSVECTOR = Text  # type: ignore[misc, assignment]

# Add missing properties to JSON comparator to support complex queries in SQLite
if not hasattr(JSON.Comparator, "astext"):
    JSON.Comparator.astext = property(lambda self: self)  # type: ignore[attr-defined]
if not hasattr(JSON.Comparator, "label"):

    def _label(self, name):
        return self

    JSON.Comparator.label = _label  # type: ignore[attr-defined]

# Strip ALL indices from models before creation to avoid SQLite OperationalErrors.
# Tests generally don't need indices for correctness.
import models  # noqa: E402

for table in models.Base.metadata.tables.values():
    table.indexes = set()

# Register missing functions for SQLite
from sqlalchemy import event  # noqa: E402
from sqlalchemy.engine import Engine  # noqa: E402


@event.listens_for(Engine, "connect")
def register_sqlite_functions(dbapi_connection, connection_record):
    # aiosqlite/sqlite3 use different ways to register functions depending on the driver
    # but for aiosqlite we usually need to access the underlying sync connection if possible
    # or rely on the sync event if we were using sync driver.
    # For aiosqlite specifically, we might need a different approach, but let's try this first.
    def left(s, n):
        return s[:n] if s else None

    try:
        dbapi_connection.create_function("left", 2, left)
    except Exception:
        pass  # Fallback if driver doesn't support it directly here


@pytest.fixture
def sample_company_data():
    """Sample company data for testing."""
    return {
        "orgnr": "123456789",
        "navn": "Test Selskap AS",
        "organisasjonsform": "AS",
        "naeringskode": "62.010",
        "antall_ansatte": 50,
        "konkurs": False,
        "under_avvikling": False,
        "under_tvangsavvikling": False,
    }


@pytest.fixture
def sample_accounting_data():
    """Sample accounting data for testing."""
    return {
        "id": 1,
        "orgnr": "123456789",
        "aar": 2023,
        "total_inntekt": 10000000,
        "aarsresultat": 500000,
        "egenkapital": 2000000,
        "driftsresultat": 750000,
        "salgsinntekter": 9000000,
        "omloepsmidler": 3000000,
        "kortsiktig_gjeld": 1500000,
        "avskrivninger": 250000,
        "anleggsmidler": 4000000,
        "langsiktig_gjeld": 3500000,
    }
