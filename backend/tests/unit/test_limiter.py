"""Unit tests for limiter configuration."""

import os
from unittest.mock import patch

import httpx
import pytest
from fastapi import FastAPI, Request
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from starlette.responses import JSONResponse


class TestLimiterConfiguration:
    """Test rate limiter storage configuration."""

    def test_limiter_uses_memory_when_no_redis_host(self):
        """Test that limiter uses in-memory storage when REDIS_HOST is not set."""
        env_vars = {
            "REDIS_HOST": "",
            "REDIS_PORT": "6379",
            "REDIS_PASSWORD": "",
        }

        with patch.dict(os.environ, env_vars, clear=False):
            # Force reimport to pick up new env vars
            import importlib

            import limiter as limiter_module

            importlib.reload(limiter_module)

            # storage_uri should be memory://
            assert limiter_module.storage_uri == "memory://"

    def test_limiter_uses_redis_when_host_set(self):
        """Test that limiter uses Redis storage when REDIS_HOST is set."""
        env_vars = {
            "REDIS_HOST": "redis-host",
            "REDIS_PORT": "6380",
            "REDIS_PASSWORD": "",
        }

        with patch.dict(os.environ, env_vars, clear=False):
            import importlib

            import limiter as limiter_module

            importlib.reload(limiter_module)

            assert limiter_module.storage_uri == "redis://redis-host:6380/1"

    def test_limiter_includes_password_in_uri(self):
        """Test that limiter includes password in Redis URI when set."""
        env_vars = {
            "REDIS_HOST": "redis-host",
            "REDIS_PORT": "6379",
            "REDIS_PASSWORD": "secret123",
        }

        with patch.dict(os.environ, env_vars, clear=False):
            import importlib

            import limiter as limiter_module

            importlib.reload(limiter_module)

            assert limiter_module.storage_uri == "redis://:secret123@redis-host:6379/1"


def _build_app(key_style: str) -> FastAPI:
    """Minimal app with one path-parameterised, rate-limited route."""
    limiter = Limiter(
        key_func=get_remote_address,
        storage_uri="memory://",
        key_style=key_style,
    )
    app = FastAPI()
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    @app.exception_handler(RateLimitExceeded)
    async def _handler(request: Request, exc: RateLimitExceeded):
        return JSONResponse(status_code=429, content={"detail": "rate limited"})

    @app.get("/item/{item_id}")
    @limiter.limit("2/minute")
    async def read_item(request: Request, item_id: str):
        return {"item_id": item_id}

    return app


class TestLimiterKeyStyle:
    """The bucket must be per (client, route), not per (client, exact URL).

    With slowapi's default key_style="url" the concrete path lands in the bucket
    key, so any endpoint taking a path parameter can be bypassed by varying that
    parameter. This is not theoretical: it let a scraper pull 167k
    /v1/companies/{orgnr}/roles responses on 2026-08-04 without one 429.
    """

    def test_production_limiter_keys_on_endpoint(self):
        import limiter as limiter_module

        assert limiter_module.limiter._key_style == "endpoint"

    def test_brreg_triggering_routes_have_sustained_limits(self):
        """Expensive public routes need minute caps in addition to burst caps."""
        import importlib

        import limiter as limiter_module
        from routers.v1 import companies as companies_module

        # Earlier configuration tests reload limiter under different env vars.
        # Re-register these decorators against the current limiter instance.
        companies_module = importlib.reload(companies_module)

        expected = {
            companies_module.fetch_company_data: {"2 per 1 second", "10 per 1 minute"},
            companies_module.get_company_subunits: {"5 per 1 second", "30 per 1 minute"},
            companies_module.get_company_roles: {"5 per 1 second", "60 per 1 minute"},
        }

        for endpoint, required_limits in expected.items():
            endpoint_key = f"{endpoint.__module__}.{endpoint.__name__}"
            configured = {str(item.limit) for item in limiter_module.limiter._route_limits[endpoint_key]}
            assert required_limits <= configured

    @pytest.mark.asyncio
    async def test_varying_path_parameter_shares_one_bucket(self):
        """A distinct path parameter per request must still hit the limit."""
        transport = httpx.ASGITransport(app=_build_app("endpoint"))
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            statuses = [(await client.get(f"/item/{i}")).status_code for i in range(4)]

        assert statuses[:2] == [200, 200]
        assert 429 in statuses[2:], f"limit never triggered: {statuses}"

    @pytest.mark.asyncio
    async def test_url_key_style_is_bypassable(self):
        """Documents the misconfiguration this guards against."""
        transport = httpx.ASGITransport(app=_build_app("url"))
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            statuses = [(await client.get(f"/item/{i}")).status_code for i in range(4)]

        assert statuses == [200, 200, 200, 200]

    @pytest.mark.asyncio
    async def test_repeated_identical_path_still_limited(self):
        """Sanity check: the limit also holds for a repeated identical URL."""
        transport = httpx.ASGITransport(app=_build_app("endpoint"))
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            statuses = [(await client.get("/item/same")).status_code for _ in range(4)]

        assert statuses[:2] == [200, 200]
        assert 429 in statuses[2:]
