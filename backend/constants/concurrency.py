"""Centralized concurrency and rate limiting constants.

Single source of truth for all concurrency-related configuration.
These values are tuned for the production environment with 4 Uvicorn workers.

Environment Overrides:
    Some constants can be overridden via environment variables for
    production tuning without code changes. See UPDATE_PAGE_SIZE and
    SUBUNIT_UPDATE_PAGE_SIZE below.
"""

import os

# =============================================================================
# EXTERNAL API CONCURRENCY
# =============================================================================
# Maximum parallel requests to Brønnøysund, Geonorge, SSB, etc.
API_CONCURRENCY_LIMIT = 10

# =============================================================================
# DATABASE
# =============================================================================
# Commit after N records for efficiency during bulk operations
DB_COMMIT_CHUNK_SIZE = 25

# =============================================================================
# FULL-TEXT SEARCH (FTS) CAPACITY
# =============================================================================
# Semaphore limits for concurrent FTS searches (scaled for social media launch)
COMPANY_SEARCH_SEMAPHORE_SIZE = 16
SUBUNIT_SEARCH_SEMAPHORE_SIZE = 8
SEARCH_SEMAPHORE_TIMEOUT = 5.0  # seconds

# =============================================================================
# IN-MEMORY CACHES (per worker)
# =============================================================================
# Note: With 4 workers, total objects = value * 4. Plan RAM accordingly.
SEARCH_CACHE_SIZE = 500
SEARCH_CACHE_TTL = 60  # seconds

STATS_CACHE_SIZE = 100
STATS_CACHE_TTL = 60

PARENT_NAME_CACHE_SIZE = 1000
PARENT_NAME_CACHE_TTL = 3600  # 1 hour

QUERY_CACHE_SIZE = 100
QUERY_CACHE_TTL = 300  # 5 minutes

# =============================================================================
# EXTERNAL API TIMEOUTS
# =============================================================================
SSB_REQUEST_TIMEOUT = 60.0
GEOCODING_TIMEOUT = 10.0
DEFAULT_EXTERNAL_TIMEOUT = 30.0
CONNECT_TIMEOUT = 10.0

# =============================================================================
# BATCH PROCESSING & UPDATE PAGE SIZES
# =============================================================================
# These can be overridden via environment for production tuning.
BULK_IMPORT_BATCH_SIZE = 100
GEOCODING_BATCH_SIZE = 100
UPDATE_PAGE_SIZE = int(os.environ.get("UPDATE_PAGE_SIZE", "1000"))
SUBUNIT_UPDATE_PAGE_SIZE = int(os.environ.get("SUBUNIT_UPDATE_PAGE_SIZE", "100"))
SITEMAP_URLS_PER_FILE = 50000
SITEMAP_CACHE_TIMEOUT = 120.0
