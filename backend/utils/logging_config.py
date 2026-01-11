"""Structured logging configuration for Bedriftsgrafen"""

import logging
import sys
from contextvars import ContextVar

# Context variable for request ID
request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)


class ContextFilter(logging.Filter):
    """Add request context (request_id) to log records"""

    def filter(self, record: logging.LogRecord) -> bool:
        request_id = request_id_ctx.get()
        record.request_id = request_id or "no-id"
        return True


class StructuredFormatter(logging.Formatter):
    """Structured logging formatter with context"""

    FORMAT = "%(asctime)s - %(name)s - %(levelname)s - [%(request_id)s] - %(message)s"

    def __init__(self):
        """Initialize formatter with structured log format"""
        super().__init__(self.FORMAT)

    def format(self, record: logging.LogRecord) -> str:
        """Format log record with request context"""
        if not hasattr(record, "request_id"):
            record.request_id = "no-id"
        return super().format(record)


def setup_logging(level: int = logging.INFO) -> None:
    """Configure structured logging for the application

    Args:
        level: Logging level (default: INFO)
    """
    # Root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Console handler with structured formatter
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(level)
    console_handler.setFormatter(StructuredFormatter())
    console_handler.addFilter(ContextFilter())

    root_logger.addHandler(console_handler)

    # Suppress noisy third-party loggers
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
