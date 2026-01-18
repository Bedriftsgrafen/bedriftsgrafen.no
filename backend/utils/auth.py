import os
from fastapi import Header, HTTPException

# Admin API key for authentication (required for all admin endpoints)
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY")


async def verify_admin_key(x_admin_key: str = Header(None, alias="X-Admin-Key")):
    """Verify admin API key from request header.

    Set ADMIN_API_KEY environment variable to enable authentication.
    If not set, admin endpoints are publicly accessible (development mode).
    """
    if ADMIN_API_KEY:
        if not x_admin_key:
            raise HTTPException(status_code=401, detail="Missing X-Admin-Key header")
        if x_admin_key != ADMIN_API_KEY:
            raise HTTPException(status_code=403, detail="Invalid admin API key")


def is_admin(x_admin_key: str | None = None) -> bool:
    """Check if the provided key is a valid admin key tanpa raising exceptions."""
    if not ADMIN_API_KEY:
        return True
    return x_admin_key == ADMIN_API_KEY
