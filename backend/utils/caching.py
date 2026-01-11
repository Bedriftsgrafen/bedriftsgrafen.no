"""HTTP caching utilities for API responses"""

from fastapi.responses import Response


def set_subunit_search_cache(
    response: Response, query: str, limit: int, result_count: int, ttl_seconds: int = 1800, stale_seconds: int = 3600
) -> None:
    """
    Set HTTP caching headers for subunit search responses.

    Search results cache for shorter duration since new data arrives frequently.

    Args:
        response: FastAPI Response object
        query: Search query string
        limit: Result limit
        result_count: Number of results returned
        ttl_seconds: Cache TTL in seconds (default 30 min)
        stale_seconds: Stale-while-revalidate duration (default 1 hour)

    Headers Set:
        Cache-Control: public, max-age={ttl_seconds}, stale-while-revalidate={stale_seconds}
        ETag: "{query}-{limit}-{result_count}"
    """
    if not response:
        return

    response.headers["Cache-Control"] = f"public, max-age={ttl_seconds}, stale-while-revalidate={stale_seconds}"
    response.headers["ETag"] = f'"{query}-{limit}-{result_count}"'


def set_subunit_detail_cache(
    response: Response, orgnr: str, total_count: int, ttl_seconds: int = 3600, stale_seconds: int = 86400
) -> None:
    """
    Set HTTP caching headers for subunit detail (by parent org) responses.

    Subunits rarely change, so cache for longer duration.
    Browsers can serve stale data for 24h while refreshing in background.

    Args:
        response: FastAPI Response object
        orgnr: Organization number of parent company
        total_count: Total number of subunits available
        ttl_seconds: Cache TTL in seconds (default 1 hour)
        stale_seconds: Stale-while-revalidate duration (default 24 hours)

    Headers Set:
        Cache-Control: public, max-age={ttl_seconds}, stale-while-revalidate={stale_seconds}
        ETag: "{orgnr}-subunits-{total_count}"
    """
    if not response:
        return

    response.headers["Cache-Control"] = f"public, max-age={ttl_seconds}, stale-while-revalidate={stale_seconds}"
    response.headers["ETag"] = f'"{orgnr}-subunits-{total_count}"'
