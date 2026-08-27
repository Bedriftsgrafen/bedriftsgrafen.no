"""
BaseExternalService - Base class for external API services.

Provides common HTTP client setup, retry logic, and error handling
that can be inherited by specific API services (Brreg, SSB, etc.).
"""

import asyncio
import logging
import random
import time
from dataclasses import dataclass
from typing import Any, ClassVar

import httpx

from constants.concurrency import CONNECT_TIMEOUT, DEFAULT_EXTERNAL_TIMEOUT
from services.brreg_egress_guard import BrregEgressGuardError, acquire_brreg_egress_capacity, brreg_traffic_class
from utils.metrics import (
    BRREG_API_REQUESTS_TOTAL,
    BRREG_CIRCUIT_OPEN_TOTAL,
    BRREG_HTTP_ATTEMPTS_TOTAL,
    BRREG_LOGICAL_OPERATIONS_TOTAL,
    BRREG_RETRIES_TOTAL,
)

logger = logging.getLogger(__name__)

# Circuit breaker defaults
_CIRCUIT_FAILURE_THRESHOLD = 20  # consecutive failures before opening
_CIRCUIT_WINDOW_SECONDS = 60  # rolling window for failure counting
_CIRCUIT_COOLDOWN_SECONDS = 300  # time the circuit stays open (5 min)


@dataclass(slots=True)
class _CircuitState:
    failure_count: int = 0
    last_failure_time: float = 0.0
    open_until: float = 0.0


class ExternalApiException(Exception):
    """Exception raised when an external API call fails."""

    def __init__(
        self,
        message: str,
        service: str = "External API",
        details: str | None = None,
        status_code: int | None = None,
    ):
        self.message = message
        self.service = service
        self.details = details
        self.status_code = status_code
        super().__init__(f"{service}: {message}" + (f" - {details}" if details else ""))


class RateLimitException(ExternalApiException):
    """Exception raised when rate limit is exceeded."""

    def __init__(self, service: str = "External API"):
        super().__init__(
            message="Rate limit exceeded",
            service=service,
            details="Exhausted retries after rate limit errors",
            status_code=429,
        )


class CircuitOpenException(ExternalApiException):
    """Exception raised when a circuit breaker blocks an external request."""

    def __init__(self, service: str, context: str):
        super().__init__(
            message=f"Circuit open — too many consecutive failures for {context}",
            service=service,
            details="Service temporarily unavailable; will retry automatically",
            status_code=503,
        )


class BaseExternalService:
    """
    Base class for external API services.

    Provides:
    - Configurable HTTP client with timeouts
    - Retry logic with exponential backoff
    - Rate limit handling
    - Consistent error handling and logging

    Subclasses should override class attributes and implement
    service-specific methods using self._get() and self._post().

    Example:
        class MyApiService(BaseExternalService):
            SERVICE_NAME = "My API"
            BASE_URL = "https://api.example.com"

            async def fetch_data(self, id: str):
                response = await self._get(f"{self.BASE_URL}/data/{id}")
                return response.json() if response.status_code == 200 else None
    """

    # Override in subclasses
    SERVICE_NAME: str = "External API"
    BASE_URL: str = ""

    # Default configuration (can be overridden)
    DEFAULT_TIMEOUT: float = DEFAULT_EXTERNAL_TIMEOUT
    CONNECT_TIMEOUT: float = CONNECT_TIMEOUT
    RETRY_ATTEMPTS: int = 3
    RETRY_DELAY: float = 1.0
    RATE_LIMIT_BACKOFF_MULTIPLIER: float = 2.0
    MAX_RATE_LIMIT_RETRIES: int = 2

    # Circuit state is shared across service instances, but isolated by endpoint.
    _circuit_states: ClassVar[dict[str, _CircuitState]] = {}

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        cls._circuit_states = {}

    def __init__(self, client: httpx.AsyncClient | None = None):
        """
        Initialize the service.

        Args:
            client: Optional shared httpx.AsyncClient. If not provided,
                   a new client is created for each request.
        """
        self.client = client
        self.timeout = httpx.Timeout(self.DEFAULT_TIMEOUT, connect=self.CONNECT_TIMEOUT)

    async def _get(
        self,
        url: str,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        context: str = "request",
    ) -> httpx.Response:
        """
        Execute GET request with retry logic.

        Args:
            url: Full URL to request
            params: Optional query parameters
            headers: Optional request headers
            context: Description for logging (e.g., "company 923609016")

        Returns:
            httpx.Response object (caller should check status_code)

        Raises:
            ExternalApiException: On non-retryable errors
            RateLimitException: When rate limit retries exhausted
        """
        return await self._request_with_retry("GET", url, params=params, headers=headers, context=context)

    async def _post(
        self,
        url: str,
        json: dict[str, Any] | None = None,
        data: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        context: str = "request",
    ) -> httpx.Response:
        """
        Execute POST request with retry logic.

        Args:
            url: Full URL to request
            json: Optional JSON body
            data: Optional form data
            headers: Optional request headers
            context: Description for logging

        Returns:
            httpx.Response object

        Raises:
            ExternalApiException: On non-retryable errors
            RateLimitException: When rate limit retries exhausted
        """
        return await self._request_with_retry("POST", url, json=json, data=data, headers=headers, context=context)

    async def _perform_request(
        self,
        client: httpx.AsyncClient,
        method: str,
        url: str,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        data: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> httpx.Response:
        """Helper to perform the actual HTTP request."""
        if method.upper() == "GET":
            return await client.get(url, params=params, headers=headers)
        elif method.upper() == "POST":
            return await client.post(url, json=json, data=data, headers=headers)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")

    @classmethod
    def _reset_circuit_state(cls, endpoint: str | None = None) -> None:
        """Reset one endpoint circuit, or every endpoint when omitted."""
        if endpoint is None:
            cls._circuit_states.clear()
        else:
            cls._circuit_states.pop(endpoint, None)

    def _is_circuit_open(self, endpoint: str) -> bool:
        """Return True if this endpoint's circuit is currently open."""
        now = time.monotonic()
        cls = type(self)
        state = cls._circuit_states.get(endpoint)
        if state is None:
            return False
        if state.open_until > 0 and now < state.open_until:
            return True
        if state.open_until > 0 and now >= state.open_until:
            # Cooldown expired — reset so the next request can probe
            cls._circuit_states.pop(endpoint, None)
        return False

    def _record_success(self, endpoint: str) -> None:
        """Reset this endpoint's circuit breaker on a successful request."""
        cls = type(self)
        state = cls._circuit_states.pop(endpoint, None)
        if state is not None and (state.failure_count > 0 or state.open_until > 0):
            event_name = "brreg.circuit_closed" if self.SERVICE_NAME == "Brønnøysund" else "external.circuit_closed"
            logger.info("%s: %s endpoint=%s", self.SERVICE_NAME, event_name, endpoint)

    def _record_failure(self, endpoint: str) -> bool:
        """Track endpoint failures and return whether this failure opened its circuit."""
        cls = type(self)
        now = time.monotonic()
        state = cls._circuit_states.setdefault(endpoint, _CircuitState())
        # Reset counter if the last failure is outside the rolling window
        if now - state.last_failure_time > _CIRCUIT_WINDOW_SECONDS:
            state.failure_count = 0
        state.failure_count += 1
        state.last_failure_time = now
        if state.failure_count >= _CIRCUIT_FAILURE_THRESHOLD and state.open_until == 0.0:
            state.open_until = now + _CIRCUIT_COOLDOWN_SECONDS
            event_name = "brreg.circuit_opened" if self.SERVICE_NAME == "Brønnøysund" else "external.circuit_opened"
            logger.error(
                "%s: %s endpoint=%s — %d consecutive failures; blocking calls for %ds",
                self.SERVICE_NAME,
                event_name,
                endpoint,
                state.failure_count,
                _CIRCUIT_COOLDOWN_SECONDS,
            )
            return True
        return False

    def _raise_if_circuit_opened(
        self,
        circuit_opened: bool,
        *,
        endpoint: str,
        traffic_class: str,
        context: str,
    ) -> None:
        """Record a circuit transition and stop the operation that opened it."""
        if not circuit_opened:
            return
        if self.SERVICE_NAME == "Brønnøysund":
            BRREG_CIRCUIT_OPEN_TOTAL.labels(endpoint=endpoint, traffic_class=traffic_class).inc()
        raise CircuitOpenException(self.SERVICE_NAME, context)

    def _metric_endpoint(self, context: str) -> str:
        """Extract a stable low-cardinality endpoint label from a request context."""
        return (context.split(maxsplit=1)[0] if context else "request").lower()

    @staticmethod
    def _status_category(status_code: int | str) -> str:
        if isinstance(status_code, int):
            return f"{status_code // 100}xx"
        status = str(status_code)
        return status if status in {"timeout", "exception"} else "exception"

    async def _guard_brreg_egress(self, endpoint: str, traffic_class: str) -> None:
        if self.SERVICE_NAME != "Brønnøysund":
            return
        try:
            await acquire_brreg_egress_capacity(endpoint=endpoint, traffic_class=traffic_class)
        except BrregEgressGuardError as exc:
            raise ExternalApiException(
                message="Brreg egress guard rejected outbound request",
                service=self.SERVICE_NAME,
                details=str(exc),
                status_code=503,
            ) from exc

    def _record_external_request_metric(
        self,
        context: str,
        status_code: int | str,
        traffic_class: str | None = None,
        *,
        actual_attempt: bool = True,
    ) -> None:
        """Record Brreg upstream request outcomes with low-cardinality labels."""
        if self.SERVICE_NAME != "Brønnøysund":
            return

        endpoint = self._metric_endpoint(context)
        traffic_class = traffic_class or brreg_traffic_class()
        BRREG_API_REQUESTS_TOTAL.labels(endpoint=endpoint, status_code=str(status_code)).inc()
        if actual_attempt:
            BRREG_HTTP_ATTEMPTS_TOTAL.labels(
                endpoint=endpoint,
                traffic_class=traffic_class,
                status_category=self._status_category(status_code),
            ).inc()

    def _record_brreg_retry(self, endpoint: str, traffic_class: str, reason: str) -> None:
        if self.SERVICE_NAME == "Brønnøysund":
            BRREG_RETRIES_TOTAL.labels(endpoint=endpoint, traffic_class=traffic_class, reason=reason).inc()

    def _record_brreg_logical_operation(self, endpoint: str) -> None:
        """Count one caller-visible Brreg operation, independently of pages and retries."""
        if self.SERVICE_NAME == "Brønnøysund":
            BRREG_LOGICAL_OPERATIONS_TOTAL.labels(
                endpoint=endpoint,
                traffic_class=brreg_traffic_class(),
            ).inc()

    async def _request_with_retry(
        self,
        method: str,
        url: str,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        data: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        context: str = "request",
    ) -> httpx.Response:
        """
        Execute HTTP request with retry logic for timeouts and rate limits.

        Returns the response object for 2xx and 404 status codes.
        Raises exceptions for other errors after retries exhausted.
        """
        endpoint = self._metric_endpoint(context)
        traffic_class = brreg_traffic_class() if self.SERVICE_NAME == "Brønnøysund" else "unknown"

        if self._is_circuit_open(endpoint):
            self._record_external_request_metric(
                context,
                "circuit_open",
                traffic_class=traffic_class,
                actual_attempt=False,
            )
            raise CircuitOpenException(self.SERVICE_NAME, context)

        rate_limit_attempts = 0

        for attempt in range(self.RETRY_ATTEMPTS):
            try:
                await self._guard_brreg_egress(endpoint, traffic_class)

                # Use shared client if available, otherwise create temporary one
                if self.client:
                    response = await self._perform_request(self.client, method, url, params, json, data, headers)
                else:
                    async with httpx.AsyncClient(timeout=self.timeout) as client:
                        response = await self._perform_request(client, method, url, params, json, data, headers)

                self._record_external_request_metric(context, response.status_code, traffic_class=traffic_class)

                # Success, Not Found, or Gone - return to caller to handle
                # 410 (Gone) is common for deleted Brreg companies
                if response.status_code in (200, 201, 204, 404, 410):
                    self._record_success(endpoint)
                    return response

                # Rate limit - exponential backoff with jitter
                if response.status_code == 429:
                    rate_limit_attempts += 1
                    if rate_limit_attempts >= self.MAX_RATE_LIMIT_RETRIES:
                        raise RateLimitException(self.SERVICE_NAME)

                    self._record_brreg_retry(endpoint, traffic_class, "rate_limited")
                    backoff = (
                        self.RETRY_DELAY
                        * (self.RATE_LIMIT_BACKOFF_MULTIPLIER ** (rate_limit_attempts - 1))
                        * random.uniform(0.8, 1.2)  # noqa: S311
                    )
                    logger.debug("%s: rate limited for %s, backoff %.2fs", self.SERVICE_NAME, context, backoff)
                    await asyncio.sleep(backoff)
                    continue

                # Other errors
                logger.debug(
                    "%s: API error for %s: %d (attempt %d/%d)",
                    self.SERVICE_NAME,
                    context,
                    response.status_code,
                    attempt + 1,
                    self.RETRY_ATTEMPTS,
                )
                if attempt == self.RETRY_ATTEMPTS - 1:
                    circuit_opened = self._record_failure(endpoint)
                    self._raise_if_circuit_opened(
                        circuit_opened,
                        endpoint=endpoint,
                        traffic_class=traffic_class,
                        context=context,
                    )
                    logger.error(
                        "%s: exhausted retries for %s (last status %d)",
                        self.SERVICE_NAME,
                        context,
                        response.status_code,
                    )
                    raise ExternalApiException(
                        message=f"Failed to fetch {context}",
                        service=self.SERVICE_NAME,
                        details=f"Status code: {response.status_code}",
                        status_code=response.status_code,
                    )
                self._record_brreg_retry(endpoint, traffic_class, "status")

            except (RateLimitException, ExternalApiException):  # fmt: skip
                raise

            except httpx.TimeoutException:
                self._record_external_request_metric(context, "timeout", traffic_class=traffic_class)
                logger.debug(
                    "%s: timeout for %s (attempt %d/%d)",
                    self.SERVICE_NAME,
                    context,
                    attempt + 1,
                    self.RETRY_ATTEMPTS,
                )
                if attempt < self.RETRY_ATTEMPTS - 1:
                    self._record_brreg_retry(endpoint, traffic_class, "timeout")
                    delay = self.RETRY_DELAY * (attempt + 1) * random.uniform(0.8, 1.2)  # noqa: S311
                    await asyncio.sleep(delay)
                else:
                    circuit_opened = self._record_failure(endpoint)
                    self._raise_if_circuit_opened(
                        circuit_opened,
                        endpoint=endpoint,
                        traffic_class=traffic_class,
                        context=context,
                    )
                    logger.warning(
                        "%s: timeout fetching %s after %d attempts",
                        self.SERVICE_NAME,
                        context,
                        self.RETRY_ATTEMPTS,
                    )
                    raise ExternalApiException(
                        message=f"Timeout fetching {context}",
                        service=self.SERVICE_NAME,
                        details=f"Failed after {self.RETRY_ATTEMPTS} attempts",
                    )

            except Exception as e:
                self._record_external_request_metric(context, "exception", traffic_class=traffic_class)
                logger.error("%s: error fetching %s: %s", self.SERVICE_NAME, context, e)
                if attempt == self.RETRY_ATTEMPTS - 1:
                    circuit_opened = self._record_failure(endpoint)
                    self._raise_if_circuit_opened(
                        circuit_opened,
                        endpoint=endpoint,
                        traffic_class=traffic_class,
                        context=context,
                    )
                    raise ExternalApiException(
                        message=f"Failed to fetch {context}", service=self.SERVICE_NAME, details=str(e)
                    )
                self._record_brreg_retry(endpoint, traffic_class, "exception")

            # Jittered backoff between retries
            if attempt < self.RETRY_ATTEMPTS - 1:
                delay = self.RETRY_DELAY * random.uniform(0.8, 1.2)  # noqa: S311
                await asyncio.sleep(delay)

        raise ExternalApiException(
            message=f"Failed to fetch {context} after {self.RETRY_ATTEMPTS} attempts", service=self.SERVICE_NAME
        )
