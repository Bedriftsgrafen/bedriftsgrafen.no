"""Client-error reporting endpoint.

Receives JavaScript errors caught by the frontend ErrorBoundary and logs
them to a dedicated rotating file (backend/logs/client_errors.log).

Security:
- Rate limited: 10 requests/minute per IP (SlowAPI)
- All input length-capped to prevent log-flooding DoS
- PII redacted server-side (tokens, FNR, emails) as source-of-truth
"""

import logging
import re

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, Field

from limiter import limiter
from utils.logging_config import sanitize_log

logger = logging.getLogger(__name__)
client_error_logger = logging.getLogger("bedriftsgrafen.client_errors")

# PII redaction patterns applied before writing to log
_REDACT_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\b(token|key|password|secret|authorization|bearer)[\s=:][^\s&]*", re.IGNORECASE), r"\1=[REDACTED]"),
    (re.compile(r"\b\d{11}\b"), "[FNR-REDACTED]"),
    (re.compile(r"\b[\w.\-]+@[\w.\-]+\.\w+\b"), "[EMAIL-REDACTED]"),
]

router = APIRouter(prefix="/v1/client-errors", tags=["observability"])


class ClientErrorPayload(BaseModel):
    message: str = Field(..., max_length=500)
    stack: str | None = Field(None, max_length=5000)
    component_stack: str | None = Field(None, max_length=5000)
    url: str = Field(..., max_length=500)
    user_agent: str | None = Field(None, max_length=300)


def _redact(text: str | None) -> str | None:
    """Apply PII redaction patterns to a string."""
    if not text:
        return text
    for pattern, replacement in _REDACT_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


@router.post("", status_code=204)
@limiter.limit("10/minute")
async def report_client_error(
    request: Request,
    payload: ClientErrorPayload,
) -> Response:
    """Receive a JavaScript error report from the frontend ErrorBoundary."""
    # Avoid reserved LogRecord keys like "message" in the extra dict.
    client_error_logger.error(
        "client_error",
        extra={
            "client_message": sanitize_log(_redact(payload.message) or ""),
            "client_stack": sanitize_log(_redact(payload.stack) or ""),
            "client_component_stack": sanitize_log(_redact(payload.component_stack) or ""),
            "client_url": sanitize_log(_redact(payload.url) or ""),
            "client_user_agent": sanitize_log(payload.user_agent or ""),
        },
    )
    return Response(status_code=204)
