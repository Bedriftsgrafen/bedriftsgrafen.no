"""Custom middleware for request tracking and context"""

import logging
import time
import uuid
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from utils.logging_config import request_id_ctx

logger = logging.getLogger(__name__)


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
            logger.info(f"{request.method} {request.url.path} - {response.status_code} - {duration:.3f}s")

            return response

        except Exception:
            # Log exceptions with request ID
            duration = time.time() - start_time
            logger.error(f"{request.method} {request.url.path} - Exception after {duration:.3f}s", exc_info=True)
            raise
