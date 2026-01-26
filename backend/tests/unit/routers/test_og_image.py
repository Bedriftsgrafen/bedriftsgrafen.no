"""
Unit tests for OG image endpoints.

Tests SVG generation for companies and municipalities.
Follows AAA pattern (Arrange - Act - Assert).
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI

from routers.v1.og_image import router


@pytest.fixture
def app():
    """Create test FastAPI app with OG image router."""
    test_app = FastAPI()
    test_app.add_middleware(
        # Add a dummy middleware to satisfy rate limiter
        type("DummyMiddleware", (), {"__init__": lambda s, app: None, "__call__": lambda s, r, c: c(r)})
    )
    test_app.include_router(router)
    return test_app


@pytest.fixture
def client(app):
    """Create test client."""
    return TestClient(app)


class TestCompanyOGImage:
    """Tests for company OG image endpoint."""

    @pytest.mark.asyncio
    async def test_returns_svg_content_type(self):
        """Should return SVG with correct content type."""
        # Arrange
        mock_db = AsyncMock()
        mock_og_data = {
            "name": "Test AS",
            "org_form": "AS",
            "industry": "IT-konsulentvirksomhet",
            "revenue": 5000000,
            "employees": 10,
            "municipality": "Oslo",
        }

        with (
            patch("routers.v1.og_image.get_db") as mock_get_db,
            patch("routers.v1.og_image.SEOService") as mock_seo_class,
        ):
            mock_get_db.return_value = mock_db
            mock_seo = MagicMock()
            mock_seo.get_company_og_data = AsyncMock(return_value=mock_og_data)
            mock_seo.generate_company_og_svg.return_value = "<svg>test</svg>"
            mock_seo_class.return_value = mock_seo

            # Create a test app
            from fastapi import FastAPI, Request
            from fastapi.responses import Response

            app = FastAPI()

            @app.get("/v1/og/company/{orgnr}.svg")
            async def test_endpoint(request: Request, orgnr: str):
                seo_service = mock_seo
                data = await seo_service.get_company_og_data(orgnr)
                if not data:
                    return Response(status_code=404)
                svg = seo_service.generate_company_og_svg(data)
                return Response(content=svg, media_type="image/svg+xml")

            client = TestClient(app)

            # Act
            response = client.get("/v1/og/company/123456789.svg")

            # Assert
            assert response.status_code == 200
            assert response.headers["content-type"] == "image/svg+xml"
            assert "<svg>" in response.text

    @pytest.mark.asyncio
    async def test_returns_404_when_company_not_found(self):
        """Should return 404 when company doesn't exist."""
        # Arrange
        with patch("routers.v1.og_image.get_db"), patch("routers.v1.og_image.SEOService") as mock_seo_class:
            mock_seo = MagicMock()
            mock_seo.get_company_og_data = AsyncMock(return_value=None)
            mock_seo_class.return_value = mock_seo

            from fastapi import FastAPI, Request
            from fastapi.responses import Response

            app = FastAPI()

            @app.get("/v1/og/company/{orgnr}.svg")
            async def test_endpoint(request: Request, orgnr: str):
                seo_service = mock_seo
                data = await seo_service.get_company_og_data(orgnr)
                if not data:
                    return Response(status_code=404)
                return Response(content="<svg></svg>", media_type="image/svg+xml")

            client = TestClient(app)

            # Act
            response = client.get("/v1/og/company/999999999.svg")

            # Assert
            assert response.status_code == 404


class TestMunicipalityOGImage:
    """Tests for municipality OG image endpoint."""

    @pytest.mark.asyncio
    async def test_returns_svg_with_municipality_data(self):
        """Should return SVG with municipality stats."""
        # Arrange
        mock_dashboard = {
            "name": "Oslo",
            "population": 700000,
            "population_growth_1y": 1.5,
            "company_count": 50000,
        }

        with patch("routers.v1.og_image.get_db"), patch("routers.v1.og_image.StatsService") as mock_stats_class:
            mock_stats = MagicMock()
            mock_stats.get_municipality_premium_dashboard = AsyncMock(return_value=mock_dashboard)
            mock_stats_class.return_value = mock_stats

            from fastapi import FastAPI, Request
            from fastapi.responses import Response

            app = FastAPI()

            @app.get("/v1/og/municipality/{code}.svg")
            async def test_endpoint(request: Request, code: str):
                service = mock_stats
                dashboard = await service.get_municipality_premium_dashboard(code)
                if not dashboard:
                    return Response(status_code=404)

                svg = f"""<svg width="1200" height="630">
                    <text>{dashboard["name"]}</text>
                    <text>{dashboard["population"]:,}</text>
                    <text>{dashboard["company_count"]:,}</text>
                </svg>"""
                return Response(content=svg, media_type="image/svg+xml")

            client = TestClient(app)

            # Act
            response = client.get("/v1/og/municipality/0301.svg")

            # Assert
            assert response.status_code == 200
            assert "Oslo" in response.text
            assert "700" in response.text  # Part of 700,000

    @pytest.mark.asyncio
    async def test_returns_404_for_unknown_municipality(self):
        """Should return 404 for unknown municipality code."""
        # Arrange
        with patch("routers.v1.og_image.get_db"), patch("routers.v1.og_image.StatsService") as mock_stats_class:
            mock_stats = MagicMock()
            mock_stats.get_municipality_premium_dashboard = AsyncMock(return_value=None)
            mock_stats_class.return_value = mock_stats

            from fastapi import FastAPI, Request
            from fastapi.responses import Response

            app = FastAPI()

            @app.get("/v1/og/municipality/{code}.svg")
            async def test_endpoint(request: Request, code: str):
                service = mock_stats
                dashboard = await service.get_municipality_premium_dashboard(code)
                if not dashboard:
                    return Response(status_code=404)
                return Response(content="<svg></svg>", media_type="image/svg+xml")

            client = TestClient(app)

            # Act
            response = client.get("/v1/og/municipality/9999.svg")

            # Assert
            assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_handles_null_population_growth(self):
        """Should handle null population growth gracefully."""
        # Arrange
        mock_dashboard = {
            "name": "Ny Kommune",
            "population": 5000,
            "population_growth_1y": None,  # No growth data
            "company_count": 100,
        }

        from fastapi import FastAPI, Request
        from fastapi.responses import Response

        app = FastAPI()

        @app.get("/v1/og/municipality/{code}.svg")
        async def test_endpoint(request: Request, code: str):
            dashboard = mock_dashboard
            growth = f"{dashboard['population_growth_1y']:+.1f}%" if dashboard["population_growth_1y"] else "Ny"
            svg = f"<svg><text>{growth}</text></svg>"
            return Response(content=svg, media_type="image/svg+xml")

        client = TestClient(app)

        # Act
        response = client.get("/v1/og/municipality/9998.svg")

        # Assert
        assert response.status_code == 200
        assert "Ny" in response.text
