"""
Centralized concurrency and rate limiting constants.

Single source of truth for all concurrency-related configuration.
"""

# External API concurrency (Brønnøysund, Geonorge, SSB)
API_CONCURRENCY_LIMIT = 10

# Database commit chunk size (commit after N records for efficiency)
DB_COMMIT_CHUNK_SIZE = 25

# Full-text search semaphore limits
COMPANY_SEARCH_SEMAPHORE_SIZE = 8
SUBUNIT_SEARCH_SEMAPHORE_SIZE = 4

# Search timeout (seconds)
SEARCH_SEMAPHORE_TIMEOUT = 5.0
