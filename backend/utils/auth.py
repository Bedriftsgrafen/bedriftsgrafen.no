import logging
import os
import secrets

from fastapi import Header, HTTPException, Request

logger = logging.getLogger(__name__)

# Admin API key for authentication (required for all admin endpoints)
ADMIN_API_KEY = os.getenv("ADMIN_API_KEY")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# Security: Enforce ADMIN_API_KEY in production
if ENVIRONMENT == "production" and not ADMIN_API_KEY:
    raise RuntimeError(
        "CRITICAL: ADMIN_API_KEY environment variable must be set in production. "
        "Generate one with: openssl rand -hex 32"
    )


async def verify_admin_key(
    request: Request,
    x_admin_key: str = Header(None, alias="X-Admin-Key"),
):
    """Verify admin API key from request header.

    Security features:
    - Enforced in production (ADMIN_API_KEY must be set)
    - Constant-time comparison (prevents timing attacks)
    - Audit logging for failed authentication attempts
    """
    # Get client IP for logging (handle proxy headers)
    client_ip = request.headers.get("X-Forwarded-For", request.client.host if request.client else "unknown")
    if "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()

    # In development without ADMIN_API_KEY, allow access (with warning)
    if not ADMIN_API_KEY:
        logger.warning(
            f"SECURITY: Admin endpoint accessed without authentication (ADMIN_API_KEY not set) - "
            f"IP: {client_ip}, Path: {request.url.path}"
        )
        return

    if not x_admin_key:
        logger.warning(f"SECURITY: Admin auth failed - missing header - IP: {client_ip}, Path: {request.url.path}")
        raise HTTPException(status_code=401, detail="Missing X-Admin-Key header")

    # Use constant-time comparison to prevent timing attacks
    if not secrets.compare_digest(x_admin_key.encode("utf-8"), ADMIN_API_KEY.encode("utf-8")):
        logger.warning(f"SECURITY: Admin auth failed - invalid key - IP: {client_ip}, Path: {request.url.path}")
        raise HTTPException(status_code=403, detail="Invalid admin API key")

    # Log successful admin access for audit trail
    logger.info(f"Admin access granted - IP: {client_ip}, Path: {request.url.path}")


def is_admin(x_admin_key: str | None = None) -> bool:
    """Check if the provided key is a valid admin key without raising exceptions.

    Uses constant-time comparison to prevent timing attacks.
    """
    if not ADMIN_API_KEY:
        return True
    if not x_admin_key:
        return False
    return secrets.compare_digest(x_admin_key.encode("utf-8"), ADMIN_API_KEY.encode("utf-8"))
