"""Prometheus metrics definition for Bedriftsgrafen."""

from prometheus_client import Counter, Histogram

# --- Background Sync Metrics ---

SYNC_OPERATIONS_TOTAL = Counter(
    "bedriftsgrafen_sync_operations_total",
    "Total number of synchronization operations performed",
    ["entity_type", "operation_type"],  # entity: company|subunit|role, operation: created|updated|deleted|error
)

SYNC_BATCH_PAGES_TOTAL = Counter(
    "bedriftsgrafen_sync_pages_total",
    "Total number of update pages processed from Brreg",
    ["entity_type"],
)

SYNC_LATENCY = Histogram(
    "bedriftsgrafen_sync_duration_seconds",
    "Time taken to process a single page of updates",
    ["entity_type"],
)

# --- External API Metrics ---

BRREG_API_REQUESTS_TOTAL = Counter(
    "bedriftsgrafen_brreg_api_requests_total",
    "Total number of requests to Brønnøysund API",
    ["endpoint", "status_code"],
)

# --- Database Metrics ---

DB_POOL_SIZE = Histogram(
    "bedriftsgrafen_db_pool_utilization",
    "Database connection pool utilization",
)


def init_metrics() -> None:
    """Pre-initialize metrics with default labels so they appear in Prometheus."""
    for entity in ["company", "subunit", "role"]:
        SYNC_BATCH_PAGES_TOTAL.labels(entity_type=entity).inc(0)
        SYNC_LATENCY.labels(entity_type=entity).observe(0)
        for op in ["created", "updated", "deleted", "error"]:
            SYNC_OPERATIONS_TOTAL.labels(entity_type=entity, operation_type=op).inc(0)
