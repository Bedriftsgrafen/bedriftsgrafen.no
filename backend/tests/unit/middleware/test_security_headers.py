"""Tests for security headers middleware.

Tests cover:
- X-Content-Type-Options header
- X-Frame-Options header
- X-XSS-Protection header
- Referrer-Policy header
- Permissions-Policy header
- HSTS header (production only)
"""

import os
import pytest
from unittest.mock import patch, MagicMock
from starlette.responses import Response
from starlette.requests import Request

from middleware import SecurityHeadersMiddleware


class TestSecurityHeadersMiddleware:
    """Tests for SecurityHeadersMiddleware."""

    @pytest.fixture
    def middleware(self):
        """Create middleware instance."""
        return SecurityHeadersMiddleware(app=MagicMock())

    @pytest.fixture
    def mock_request(self):
        """Create mock request."""
        request = MagicMock(spec=Request)
        return request

    @pytest.fixture
    def mock_response(self):
        """Create mock response with mutable headers."""
        response = MagicMock(spec=Response)
        response.headers = {}
        return response

    @pytest.mark.asyncio
    async def test_sets_x_content_type_options(self, middleware, mock_request, mock_response):
        """Should set X-Content-Type-Options: nosniff."""

        async def call_next(request):
            return mock_response

        result = await middleware.dispatch(mock_request, call_next)

        assert result.headers["X-Content-Type-Options"] == "nosniff"

    @pytest.mark.asyncio
    async def test_sets_x_frame_options(self, middleware, mock_request, mock_response):
        """Should set X-Frame-Options: DENY."""

        async def call_next(request):
            return mock_response

        result = await middleware.dispatch(mock_request, call_next)

        assert result.headers["X-Frame-Options"] == "DENY"

    @pytest.mark.asyncio
    async def test_sets_x_xss_protection(self, middleware, mock_request, mock_response):
        """Should set X-XSS-Protection header."""

        async def call_next(request):
            return mock_response

        result = await middleware.dispatch(mock_request, call_next)

        assert result.headers["X-XSS-Protection"] == "1; mode=block"

    @pytest.mark.asyncio
    async def test_sets_referrer_policy(self, middleware, mock_request, mock_response):
        """Should set Referrer-Policy header."""

        async def call_next(request):
            return mock_response

        result = await middleware.dispatch(mock_request, call_next)

        assert result.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"

    @pytest.mark.asyncio
    async def test_sets_permissions_policy(self, middleware, mock_request, mock_response):
        """Should set Permissions-Policy header."""

        async def call_next(request):
            return mock_response

        result = await middleware.dispatch(mock_request, call_next)

        permissions = result.headers["Permissions-Policy"]
        assert "geolocation=()" in permissions
        assert "microphone=()" in permissions
        assert "camera=()" in permissions
        assert "payment=()" in permissions

    @pytest.mark.asyncio
    async def test_hsts_set_in_production(self, mock_request, mock_response):
        """Should set HSTS header in production environment."""
        with patch.dict(os.environ, {"ENVIRONMENT": "production"}):
            # Re-import to pick up new env
            import importlib
            import middleware as middleware_module

            importlib.reload(middleware_module)

            middleware = middleware_module.SecurityHeadersMiddleware(app=MagicMock())

            async def call_next(request):
                return mock_response

            result = await middleware.dispatch(mock_request, call_next)

            hsts = result.headers.get("Strict-Transport-Security")
            assert hsts is not None
            assert "max-age=31536000" in hsts
            assert "includeSubDomains" in hsts

    @pytest.mark.asyncio
    async def test_hsts_not_set_in_development(self, mock_request, mock_response):
        """Should NOT set HSTS header in development environment."""
        with patch.dict(os.environ, {"ENVIRONMENT": "development"}):
            import importlib
            import middleware as middleware_module

            importlib.reload(middleware_module)

            middleware = middleware_module.SecurityHeadersMiddleware(app=MagicMock())

            async def call_next(request):
                return mock_response

            result = await middleware.dispatch(mock_request, call_next)

            # HSTS should not be set in development
            assert "Strict-Transport-Security" not in result.headers

    @pytest.mark.asyncio
    async def test_does_not_set_csp_for_api(self, middleware, mock_request, mock_response):
        """Should NOT set Content-Security-Policy (API returns JSON, not HTML)."""

        async def call_next(request):
            return mock_response

        result = await middleware.dispatch(mock_request, call_next)

        # CSP should not be set for JSON API responses
        assert "Content-Security-Policy" not in result.headers

    @pytest.mark.asyncio
    async def test_preserves_existing_headers(self, middleware, mock_request, mock_response):
        """Should not overwrite existing response headers."""
        mock_response.headers["X-Custom-Header"] = "custom-value"

        async def call_next(request):
            return mock_response

        result = await middleware.dispatch(mock_request, call_next)

        # Custom header should still be present
        assert result.headers["X-Custom-Header"] == "custom-value"
        # Security headers should also be present
        assert result.headers["X-Frame-Options"] == "DENY"


class TestRequestIdMiddleware:
    """Tests for RequestIdMiddleware."""

    @pytest.mark.asyncio
    async def test_adds_request_id_header(self):
        """Should add X-Request-ID header to response."""
        from middleware import RequestIdMiddleware

        middleware = RequestIdMiddleware(app=MagicMock())
        mock_request = MagicMock(spec=Request)
        mock_request.method = "GET"
        mock_request.url.path = "/test"

        mock_response = MagicMock(spec=Response)
        mock_response.headers = {}
        mock_response.status_code = 200

        async def call_next(request):
            return mock_response

        result = await middleware.dispatch(mock_request, call_next)

        assert "X-Request-ID" in result.headers
        # Request ID should be 8 characters (short UUID)
        assert len(result.headers["X-Request-ID"]) == 8

    @pytest.mark.asyncio
    async def test_request_id_is_unique(self):
        """Each request should get a unique request ID."""
        from middleware import RequestIdMiddleware

        middleware = RequestIdMiddleware(app=MagicMock())

        request_ids = []
        for _ in range(10):
            mock_request = MagicMock(spec=Request)
            mock_request.method = "GET"
            mock_request.url.path = "/test"

            mock_response = MagicMock(spec=Response)
            mock_response.headers = {}
            mock_response.status_code = 200

            async def call_next(request):
                return mock_response

            result = await middleware.dispatch(mock_request, call_next)
            request_ids.append(result.headers["X-Request-ID"])

        # All request IDs should be unique
        assert len(set(request_ids)) == 10
