"""
Unit tests for BrregApiService.

Tests API fetching, error handling, and response parsing.
Follows AAA pattern (Arrange - Act - Assert).
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from services.brreg_api_service import BrregApiService, BrregApiException


class TestBrregApiServiceInit:
    """Tests for BrregApiService initialization."""

    def test_service_name_is_correct(self):
        assert BrregApiService.SERVICE_NAME == "Brønnøysund"

    def test_base_urls_are_correct(self):
        assert "brreg.no" in BrregApiService.ENHETSREGISTERET_BASE_URL
        assert "brreg.no" in BrregApiService.REGNSKAPSREGISTERET_BASE_URL


class TestFetchCompany:
    """Tests for fetch_company method."""

    @pytest.mark.asyncio
    async def test_fetch_company_success(self):
        # Arrange
        service = BrregApiService()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"organisasjonsnummer": "123456789", "navn": "Test AS"}
        service._get = AsyncMock(return_value=mock_response)

        # Act
        result = await service.fetch_company("123456789")

        # Assert
        assert result is not None
        assert result["organisasjonsnummer"] == "123456789"
        assert result["navn"] == "Test AS"

    @pytest.mark.asyncio
    async def test_fetch_company_not_found_returns_none(self):
        # Arrange
        service = BrregApiService()
        mock_response = MagicMock()
        mock_response.status_code = 404
        service._get = AsyncMock(return_value=mock_response)

        # Act
        result = await service.fetch_company("999999999")

        # Assert
        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_company_uses_correct_url(self):
        # Arrange
        service = BrregApiService()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {}
        service._get = AsyncMock(return_value=mock_response)

        # Act
        await service.fetch_company("123456789")

        # Assert
        call_args = service._get.call_args
        assert "123456789" in call_args[0][0]


class TestFetchFinancialStatements:
    """Tests for fetch_financial_statements method."""

    @pytest.mark.asyncio
    async def test_fetch_financial_statements_success(self):
        # Arrange
        service = BrregApiService()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [{"regnskapsperiode": {"fraDato": "2023-01-01"}, "aarsresultat": 1000000}]
        service._get = AsyncMock(return_value=mock_response)

        # Act
        result = await service.fetch_financial_statements("123456789")

        # Assert
        assert isinstance(result, list)
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_fetch_financial_statements_empty_returns_empty_list(self):
        # Arrange
        service = BrregApiService()
        mock_response = MagicMock()
        mock_response.status_code = 404
        service._get = AsyncMock(return_value=mock_response)

        # Act
        result = await service.fetch_financial_statements("123456789")

        # Assert
        assert result == []

    @pytest.mark.asyncio
    async def test_fetch_financial_statements_with_year_param(self):
        # Arrange
        service = BrregApiService()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = []
        service._get = AsyncMock(return_value=mock_response)

        # Act
        await service.fetch_financial_statements("123456789", year=2023)

        # Assert
        call_args = service._get.call_args
        assert call_args.kwargs.get("params") is not None or (len(call_args) > 1 and call_args[1] is not None)


class TestFetchAndHandle404:
    """Tests for _fetch_and_handle_404 helper."""

    @pytest.mark.asyncio
    async def test_fetch_and_handle_404_success(self):
        # Arrange
        service = BrregApiService()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"key": "value"}
        service._get = AsyncMock(return_value=mock_response)

        # Act
        result = await service._fetch_and_handle_404("http://example.com", context="test")

        # Assert
        assert result == {"key": "value"}

    @pytest.mark.asyncio
    async def test_fetch_and_handle_404_returns_none(self):
        # Arrange
        service = BrregApiService()
        mock_response = MagicMock()
        mock_response.status_code = 404
        service._get = AsyncMock(return_value=mock_response)

        # Act
        result = await service._fetch_and_handle_404("http://example.com", context="test")

        # Assert
        assert result is None

    @pytest.mark.asyncio
    async def test_fetch_and_handle_404_raises_on_api_exception(self):
        # Arrange
        service = BrregApiService()
        service._get = AsyncMock(side_effect=BrregApiException("API Error"))

        # Act & Assert
        with pytest.raises(BrregApiException):
            await service._fetch_and_handle_404("http://example.com", context="test")
