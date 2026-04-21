"""
Unit tests for OG image endpoints.

Tests SVG generation for companies, municipalities, counties, and industries.
Follows AAA pattern (Arrange - Act - Assert).
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from routers.v1.og_image import router


def _make_app() -> FastAPI:
    app = FastAPI()
    app.include_router(router)
    return app


@pytest.fixture
def app():
    """Create test FastAPI app with OG image router."""
    return _make_app()


@pytest.fixture
def client(app):
    """Create test client."""
    return TestClient(app)


class TestCompanyOGImage:
    """Tests for company OG image endpoint."""

    @pytest.mark.asyncio
    async def test_returns_svg_content_type_and_cache_header(self):
        """Should return SVG with correct content type and Cache-Control header."""
        mock_og_data = {
            "navn": "Test AS",
            "orgnr": "123456789",
            "nace_name": "IT-konsulentvirksomhet",
            "revenue": 5000000.0,
            "profit": 500000.0,
            "employees": 10,
        }

        with (
            patch("routers.v1.og_image.get_db"),
            patch("routers.v1.og_image.SEOService") as mock_seo_class,
        ):
            mock_seo = MagicMock()
            mock_seo.get_company_og_data = AsyncMock(return_value=mock_og_data)
            mock_seo.generate_company_og_svg.return_value = "<svg>company</svg>"
            mock_seo_class.return_value = mock_seo

            client = TestClient(_make_app(), raise_server_exceptions=False)
            response = client.get("/v1/og/company/123456789.svg")

            assert response.status_code == 200
            assert "image/svg+xml" in response.headers["content-type"]
            assert "max-age=3600" in response.headers.get("cache-control", "")

    @pytest.mark.asyncio
    async def test_returns_404_when_company_not_found(self):
        """Should return 404 when company doesn't exist."""
        with (
            patch("routers.v1.og_image.get_db"),
            patch("routers.v1.og_image.SEOService") as mock_seo_class,
        ):
            mock_seo = MagicMock()
            mock_seo.get_company_og_data = AsyncMock(return_value=None)
            mock_seo_class.return_value = mock_seo

            client = TestClient(_make_app(), raise_server_exceptions=False)
            response = client.get("/v1/og/company/999999999.svg")
            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_company_og_exception_returns_404(self):
        """Service raising an exception should yield 404, not 500."""
        with (
            patch("routers.v1.og_image.get_db"),
            patch("routers.v1.og_image.SEOService") as mock_seo_class,
        ):
            mock_seo = MagicMock()
            mock_seo.get_company_og_data = AsyncMock(side_effect=RuntimeError("db error"))
            mock_seo_class.return_value = mock_seo

            client = TestClient(_make_app(), raise_server_exceptions=False)
            response = client.get("/v1/og/company/123456789.svg")
            assert response.status_code == 404


class TestMunicipalityOGImage:
    """Tests for municipality OG image endpoint."""

    @pytest.mark.asyncio
    async def test_returns_svg_content_type_and_cache_header(self):
        """Should return SVG with correct content type and Cache-Control header."""
        mock_dashboard = {
            "name": "Oslo",
            "population": 700000,
            "population_growth_1y": 1.5,
            "company_count": 50000,
        }

        with (
            patch("routers.v1.og_image.get_db"),
            patch("routers.v1.og_image.StatsService") as mock_stats_class,
            patch("routers.v1.og_image.SEOService") as mock_seo_class,
        ):
            mock_stats = MagicMock()
            mock_stats.get_municipality_premium_dashboard = AsyncMock(return_value=mock_dashboard)
            mock_stats_class.return_value = mock_stats

            mock_seo = MagicMock()
            mock_seo.generate_municipality_og_svg.return_value = "<svg>municipality</svg>"
            mock_seo_class.return_value = mock_seo

            client = TestClient(_make_app(), raise_server_exceptions=False)
            response = client.get("/v1/og/municipality/0301.svg")

            assert response.status_code == 200
            assert "image/svg+xml" in response.headers["content-type"]
            assert "max-age=3600" in response.headers.get("cache-control", "")

    @pytest.mark.asyncio
    async def test_returns_404_for_unknown_municipality(self):
        """Should return 404 for unknown municipality code."""
        with (
            patch("routers.v1.og_image.get_db"),
            patch("routers.v1.og_image.StatsService") as mock_stats_class,
            patch("routers.v1.og_image.SEOService"),
        ):
            mock_stats = MagicMock()
            mock_stats.get_municipality_premium_dashboard = AsyncMock(return_value=None)
            mock_stats_class.return_value = mock_stats

            client = TestClient(_make_app(), raise_server_exceptions=False)
            response = client.get("/v1/og/municipality/9999.svg")
            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_municipality_og_exception_returns_404(self):
        """Service raising an exception should yield 404, not 500."""
        with (
            patch("routers.v1.og_image.get_db"),
            patch("routers.v1.og_image.StatsService") as mock_stats_class,
            patch("routers.v1.og_image.SEOService"),
        ):
            mock_stats = MagicMock()
            mock_stats.get_municipality_premium_dashboard = AsyncMock(side_effect=RuntimeError("db error"))
            mock_stats_class.return_value = mock_stats

            client = TestClient(_make_app(), raise_server_exceptions=False)
            response = client.get("/v1/og/municipality/0301.svg")
            assert response.status_code == 404


class TestCountyOGImage:
    """Tests for county OG image endpoint."""

    @pytest.mark.asyncio
    async def test_county_og_not_found(self):
        """Should return 404 when county code doesn't exist."""
        with (
            patch("routers.v1.og_image.get_db"),
            patch("routers.v1.og_image.StatsService") as mock_stats_class,
            patch("routers.v1.og_image.SEOService"),
        ):
            mock_stats = MagicMock()
            mock_stats.get_county_premium_dashboard = AsyncMock(return_value=None)
            mock_stats_class.return_value = mock_stats

            client = TestClient(_make_app(), raise_server_exceptions=False)
            response = client.get("/v1/og/county/99.svg")
            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_county_og_exception_returns_404(self):
        """Service raising an exception should yield 404, not 500."""
        with (
            patch("routers.v1.og_image.get_db"),
            patch("routers.v1.og_image.StatsService") as mock_stats_class,
            patch("routers.v1.og_image.SEOService"),
        ):
            mock_stats = MagicMock()
            mock_stats.get_county_premium_dashboard = AsyncMock(side_effect=RuntimeError("db error"))
            mock_stats_class.return_value = mock_stats

            client = TestClient(_make_app(), raise_server_exceptions=False)
            response = client.get("/v1/og/county/46.svg")
            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_county_og_returns_svg_and_cache_header(self):
        """Should return 200 SVG with Cache-Control header when county exists."""
        mock_dashboard = {
            "code": "46",
            "name": "Vestland",
            "population": 634463,
            "company_count": 42000,
            "top_sectors": [{"nace_name": "Havbruk"}],
        }

        with (
            patch("routers.v1.og_image.get_db"),
            patch("routers.v1.og_image.StatsService") as mock_stats_class,
            patch("routers.v1.og_image.SEOService") as mock_seo_class,
        ):
            mock_stats = MagicMock()
            mock_stats.get_county_premium_dashboard = AsyncMock(return_value=mock_dashboard)
            mock_stats_class.return_value = mock_stats

            mock_seo = MagicMock()
            mock_seo.generate_county_og_svg.return_value = "<svg>county</svg>"
            mock_seo_class.return_value = mock_seo

            client = TestClient(_make_app(), raise_server_exceptions=False)
            response = client.get("/v1/og/county/46.svg")

            assert response.status_code == 200
            assert "image/svg+xml" in response.headers["content-type"]
            assert "max-age=3600" in response.headers.get("cache-control", "")


class TestIndustryOGImage:
    """Tests for industry OG image endpoint."""

    @pytest.mark.asyncio
    async def test_industry_og_not_found(self):
        """Should return 404 when industry code doesn't exist."""
        with (
            patch("routers.v1.og_image.get_db"),
            patch("routers.v1.og_image.StatsService") as mock_stats_class,
            patch("routers.v1.og_image.SEOService"),
        ):
            mock_stats = MagicMock()
            mock_stats.get_industry_premium_dashboard = AsyncMock(return_value=None)
            mock_stats_class.return_value = mock_stats

            client = TestClient(_make_app(), raise_server_exceptions=False)
            response = client.get("/v1/og/industry/99.svg")
            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_industry_og_exception_returns_404(self):
        """Service raising an exception should yield 404, not 500."""
        with (
            patch("routers.v1.og_image.get_db"),
            patch("routers.v1.og_image.StatsService") as mock_stats_class,
            patch("routers.v1.og_image.SEOService"),
        ):
            mock_stats = MagicMock()
            mock_stats.get_industry_premium_dashboard = AsyncMock(side_effect=RuntimeError("boom"))
            mock_stats_class.return_value = mock_stats

            client = TestClient(_make_app(), raise_server_exceptions=False)
            response = client.get("/v1/og/industry/62.svg")
            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_industry_og_returns_svg_and_cache_header(self):
        """Should return 200 SVG with Cache-Control header when industry exists."""
        mock_dashboard = {
            "nace_division": "62",
            "nace_name": "Programmeringstjenester",
            "company_count": 15000,
            "total_employees": 80000,
            "avg_revenue": 3500000.0,
        }

        with (
            patch("routers.v1.og_image.get_db"),
            patch("routers.v1.og_image.StatsService") as mock_stats_class,
            patch("routers.v1.og_image.SEOService") as mock_seo_class,
        ):
            mock_stats = MagicMock()
            mock_stats.get_industry_premium_dashboard = AsyncMock(return_value=mock_dashboard)
            mock_stats_class.return_value = mock_stats

            mock_seo = MagicMock()
            mock_seo.generate_industry_og_svg.return_value = "<svg>industry</svg>"
            mock_seo_class.return_value = mock_seo

            client = TestClient(_make_app(), raise_server_exceptions=False)
            response = client.get("/v1/og/industry/62.svg")

            assert response.status_code == 200
            assert "image/svg+xml" in response.headers["content-type"]
            assert "max-age=3600" in response.headers.get("cache-control", "")
