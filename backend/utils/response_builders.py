"""Utilities for building API responses with metadata"""

from datetime import datetime, timezone

from services.response_models import ResponseMetadata


def build_response_metadata(last_updated: datetime | None = None, source: str = "database") -> ResponseMetadata:
    """
    Build response metadata with consistent formatting.

    Args:
        last_updated: Optional timestamp of when data was last updated
        source: Source of the data ('database', 'cache', 'api')

    Returns:
        ResponseMetadata with fetched_at timestamp
    """
    return ResponseMetadata(last_updated=last_updated, source=source, fetched_at=datetime.now(timezone.utc))
