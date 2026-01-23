"""
Unit tests for SEOService.
Tests company OG data fetching and SVG generation.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock
from services.seo_service import SEOService


class TestSEOService:
    @pytest.mark.asyncio
    async def test_get_company_og_data_returns_formatted_data(self):
        # Arrange
        mock_db = MagicMock()
        service = SEOService(mock_db)

        # Mock DB response row
        mock_row = MagicMock()
        mock_row.navn = "TESTBEDRIFT AS"
        mock_row.naeringskode = "62.010"
        mock_row.antall_ansatte = 10
        mock_row.salgsinntekter = 5000000.0
        mock_row.aarsresultat = 500000.0

        mock_result = MagicMock()
        mock_result.first.return_value = mock_row
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act
        result = await service.get_company_og_data("123456789")

        # Assert
        assert result is not None
        assert result["navn"] == "TESTBEDRIFT AS"
        assert result["orgnr"] == "123456789"
        assert "Tjenester tilknyttet informasjonsteknologi" in result["nace_name"]
        assert result["revenue"] == 5000000.0
        assert result["profit"] == 500000.0
        assert result["employees"] == 10

    @pytest.mark.asyncio
    async def test_get_company_og_data_not_found(self):
        # Arrange
        mock_db = MagicMock()
        service = SEOService(mock_db)

        mock_result = MagicMock()
        mock_result.first.return_value = None
        mock_db.execute = AsyncMock(return_value=mock_result)

        # Act
        result = await service.get_company_og_data("999999999")

        # Assert
        assert result is None

    def test_generate_company_og_svg_contains_data(self):
        # Arrange
        mock_db = MagicMock()
        service = SEOService(mock_db)
        data = {
            "navn": "TESTBEDRIFT AS",
            "orgnr": "123456789",
            "nace_name": "Programmeringstjenester",
            "revenue": 5000000.0,
            "profit": 500000.0,
            "employees": 10,
        }

        # Act
        svg = service.generate_company_og_svg(data)

        # Assert
        assert "<svg" in svg
        assert "TESTBEDRIFT AS" in svg
        assert "123456789" in svg
        assert "Programmeringstjenester" in svg
        assert "5,0M" in svg  # Formatted revenue
        assert "500K" in svg  # Formatted profit
        assert "10" in svg  # Employees
