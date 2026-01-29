"""
Centralized URL constants.

Single source of truth for all external URLs and base URLs.
"""

import os

# Site base URL (can be overridden via environment for staging/dev)
BASE_URL = os.getenv("BASE_URL", "https://bedriftsgrafen.no")

# Brønnøysund API base URLs
BRREG_ENHETSREGISTERET_BASE = "https://data.brreg.no/enhetsregisteret/api"
BRREG_REGNSKAPSREGISTERET_BASE = "https://data.brreg.no/regnskapsregisteret/regnskap"

# Brønnøysund streaming update endpoints
BRREG_UPDATES_URL = f"{BRREG_ENHETSREGISTERET_BASE}/oppdateringer/enheter"
BRREG_SUBUNIT_UPDATES_URL = f"{BRREG_ENHETSREGISTERET_BASE}/oppdateringer/underenheter"
BRREG_ROLE_UPDATES_URL = f"{BRREG_ENHETSREGISTERET_BASE}/oppdateringer/roller"

# External services
GEONORGE_BASE_URL = "https://ws.geonorge.no/adresser/v1/sok"
SSB_API_BASE_URL = "https://data.ssb.no/api/v0/no/table"
