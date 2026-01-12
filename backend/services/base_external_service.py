"""
BaseExternalService - Base class for external API services.

Provides common HTTP client setup, retry logic, and error handling
that can be inherited by specific API services (Brreg, SSB, etc.).
"""

import asyncio
import logging
from abc import ABC
from typing import Any

import httpx

logger = logging.getLogger(__name__)


class ExternalApiException(Exception):
    """Exception raised when an external API call fails."""

    def __init__(self, message: str, service: str = "External API", details: str | None = None):
        self.message = message
        self.service = service
        self.details = details
        super().__init__(f"{service}: {message}" + (f" - {details}" if details else ""))


class RateLimitException(ExternalApiException):
    """Exception raised when rate limit is exceeded."""

    def __init__(self, service: str = "External API"):
        super().__init__(
            message="Rate limit exceeded", service=service, details="Exhausted retries after rate limit errors"
        )


class BaseExternalService(ABC):
    """
    Abstract base class for external API services.

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
    DEFAULT_TIMEOUT: float = 30.0
    CONNECT_TIMEOUT: float = 10.0
    RETRY_ATTEMPTS: int = 3
    RETRY_DELAY: float = 1.0
    RATE_LIMIT_BACKOFF_MULTIPLIER: float = 2.0
    MAX_RATE_LIMIT_RETRIES: int = 2

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
        rate_limit_attempts = 0

        for attempt in range(self.RETRY_ATTEMPTS):
            try:
                # Use shared client if available, otherwise create temporary one
                if self.client:
                    response = await self._perform_request(self.client, method, url, params, json, data, headers)
                else:
                    async with httpx.AsyncClient(timeout=self.timeout) as client:
                        response = await self._perform_request(client, method, url, params, json, data, headers)

                # Success or Not Found - return to caller
                if response.status_code in (200, 201, 204, 404):
                    return response

                # Rate limit - exponential backoff
                if response.status_code == 429:
                    rate_limit_attempts += 1
                    if rate_limit_attempts >= self.MAX_RATE_LIMIT_RETRIES:
                        raise RateLimitException(self.SERVICE_NAME)

                    backoff = self.RETRY_DELAY * (self.RATE_LIMIT_BACKOFF_MULTIPLIER ** (rate_limit_attempts - 1))
                    logger.warning(f"{self.SERVICE_NAME}: Rate limit for {context}, backing off {backoff}s")
                    await asyncio.sleep(backoff)
                    continue

                # Other errors
                logger.error(f"{self.SERVICE_NAME}: API error for {context}: {response.status_code}")
                if attempt == self.RETRY_ATTEMPTS - 1:
                    raise ExternalApiException(
                        message=f"Failed to fetch {context}",
                        service=self.SERVICE_NAME,
                        details=f"Status code: {response.status_code}",
                    )

            except (RateLimitException, ExternalApiException):
                raise

            except httpx.TimeoutException:
                logger.warning(
                    f"{self.SERVICE_NAME}: Timeout for {context}, attempt {attempt + 1}/{self.RETRY_ATTEMPTS}"
                )
                if attempt < self.RETRY_ATTEMPTS - 1:
                    await asyncio.sleep(self.RETRY_DELAY * (attempt + 1))
                else:
                    raise ExternalApiException(
                        message=f"Timeout fetching {context}",
                        service=self.SERVICE_NAME,
                        details=f"Failed after {self.RETRY_ATTEMPTS} attempts",
                    )

            except Exception as e:
                logger.error(f"{self.SERVICE_NAME}: Error fetching {context}: {str(e)}")
                if attempt == self.RETRY_ATTEMPTS - 1:
                    raise ExternalApiException(
                        message=f"Failed to fetch {context}", service=self.SERVICE_NAME, details=str(e)
                    )

            # Basic backoff between retries
            if attempt < self.RETRY_ATTEMPTS - 1:
                await asyncio.sleep(self.RETRY_DELAY)

        raise ExternalApiException(
            message=f"Failed to fetch {context} after {self.RETRY_ATTEMPTS} attempts", service=self.SERVICE_NAME
        )
