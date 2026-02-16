"""HTTP caching utilities for API responses"""

from fastapi.responses import Response


def set_http_cache_headers(
    response: Response,
    etag: str,
    ttl_seconds: int = 3600,
    stale_seconds: int = 86400,
) -> None:
    """
    Set HTTP caching headers (Cache-Control + ETag) on a FastAPI response.

    Args:
        response: FastAPI Response object
        etag: Unique identifier for the response content
        ttl_seconds: Cache TTL in seconds
        stale_seconds: Stale-while-revalidate duration in seconds

    Headers Set:
        Cache-Control: public, max-age={ttl_seconds}, stale-while-revalidate={stale_seconds}
        ETag: "{etag}"
    """
    if not response:
        return

    response.headers["Cache-Control"] = f"public, max-age={ttl_seconds}, stale-while-revalidate={stale_seconds}"
    response.headers["ETag"] = f'"{etag}"'
