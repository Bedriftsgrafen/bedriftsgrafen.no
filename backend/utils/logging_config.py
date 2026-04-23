"""Structured logging configuration for Bedriftsgrafen"""

import logging
import os
import sys
from contextvars import ContextVar
from logging.handlers import RotatingFileHandler

# Context variable for request ID
request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)


def sanitize_log(value: object) -> str:
    """Strip CR/LF from a value before interpolating it into a log message.

    Prevents log injection attacks where user-controlled input containing
    newlines could forge additional log entries.
    """
    return str(value).replace("\r", "").replace("\n", "")


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

    # Dedicated rotating log for client-side errors
    # Isolated from the main log so ops can tail/rotate separately.
    _setup_client_error_logger()

    # Suppress noisy third-party loggers
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)


def _setup_client_error_logger() -> None:
    """Configure a separate rotating file handler for client-side errors.

    Writes to backend/logs/client_errors.log (10 MB max, 5 rotations = 50 MB).
    Does NOT propagate to the root logger so client errors stay in their own file.
    """
    client_logger = logging.getLogger("bedriftsgrafen.client_errors")
    if client_logger.handlers:
        # Already configured (e.g. tests calling setup_logging twice)
        return

    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, "client_errors.log")

    try:
        handler = RotatingFileHandler(
            log_path,
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=5,
            encoding="utf-8",
        )
        handler.setFormatter(StructuredFormatter())
        handler.addFilter(ContextFilter())
        client_logger.addHandler(handler)
        client_logger.setLevel(logging.ERROR)
        client_logger.propagate = False  # keep client errors out of stdout
    except OSError as e:
        # Non-fatal: log to main logger and continue (e.g. read-only filesystem in tests)
        logging.getLogger(__name__).warning("Could not create client_errors.log: %s", e)
