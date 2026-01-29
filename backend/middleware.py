"""Custom middleware for request tracking, context, and security headers"""

import logging
import os
import time
import uuid
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from utils.logging_config import request_id_ctx

logger = logging.getLogger(__name__)

ENVIRONMENT = os.getenv("ENVIRONMENT", "development")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses.

    Defense-in-depth: Even though nginx may add some of these,
    having them at the app level ensures protection in development
    and provides redundancy in production.
    """

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        response = await call_next(request)

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking (embedding in frames)
        response.headers["X-Frame-Options"] = "DENY"

        # Enable browser XSS filter (legacy but still useful)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Control referrer information leakage
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Note: CSP (Content-Security-Policy) is NOT set here because:
        # 1. This API returns JSON, not HTML - CSP is for browser document rendering
        # 2. Frontend nginx handles CSP for HTML pages
        # 3. Setting CSP on JSON responses can cause issues with some clients

        # Permissions Policy - disable unnecessary browser features
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=(), payment=(), usb=()"

        # HSTS - enforce HTTPS (only in production)
        # Note: nginx may also set this, but app-level is defense-in-depth
        if ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

        return response


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Middleware to track request ID and performance metrics"""

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        # Generate unique request ID
        request_id = str(uuid.uuid4())[:8]  # Use short ID for clarity
        request_id_ctx.set(request_id)

        # Track request timing
        start_time = time.time()

        try:
            # Process request
            response = await call_next(request)

            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id

            # Log request completion
            duration = time.time() - start_time
            log_msg = f"{request.method} {request.url.path} - {response.status_code} - {duration:.3f}s"

            if request.url.path == "/health" and response.status_code == 200:
                logger.debug(log_msg)
            else:
                logger.info(log_msg)

            return response

        except Exception:
            # Log exceptions with request ID
            duration = time.time() - start_time
            logger.error(f"{request.method} {request.url.path} - Exception after {duration:.3f}s", exc_info=True)
            raise
