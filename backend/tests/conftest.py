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
