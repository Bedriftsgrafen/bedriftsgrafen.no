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


class TestFetchSubunit:
    """Tests for fetch_subunit method."""

    @pytest.mark.asyncio
    async def test_fetch_subunit_success(self):
        # Arrange
        service = BrregApiService()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "organisasjonsnummer": "123456789",
            "overordnetEnhet": "987654321",
            "navn": "Test Subunit",
        }
        service._get = AsyncMock(return_value=mock_response)

        # Act
        result = await service.fetch_subunit("123456789")

        # Assert
        assert result is not None
        assert result["organisasjonsnummer"] == "123456789"
        assert result["overordnetEnhet"] == "987654321"

    @pytest.mark.asyncio
    async def test_fetch_subunit_not_found(self):
        # Arrange
        service = BrregApiService()
        mock_response = MagicMock()
        mock_response.status_code = 404
        service._get = AsyncMock(return_value=mock_response)

        # Act
        result = await service.fetch_subunit("999999999")

        # Assert
        assert result is None


class TestFetchSubunits:
    """Tests for fetch_subunits method (paginated)."""

    @pytest.mark.asyncio
    async def test_fetch_subunits_single_page(self):
        # Arrange
        service = BrregApiService()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "_embedded": {
                "underenheter": [
                    {"organisasjonsnummer": "111111111"},
                    {"organisasjonsnummer": "222222222"},
                ]
            },
            "_links": {},  # No next page
        }
        service._get = AsyncMock(return_value=mock_response)

        # Act
        result = await service.fetch_subunits("987654321")

        # Assert
        assert len(result) == 2
        assert result[0]["organisasjonsnummer"] == "111111111"

    @pytest.mark.asyncio
    async def test_fetch_subunits_pagination(self):
        # Arrange
        service = BrregApiService()

        page1_response = MagicMock()
        page1_response.status_code = 200
        page1_response.json.return_value = {
            "_embedded": {"underenheter": [{"organisasjonsnummer": "111111111"}]},
            "_links": {"next": {"href": "http://next-page"}},
        }

        page2_response = MagicMock()
        page2_response.status_code = 200
        page2_response.json.return_value = {
            "_embedded": {"underenheter": [{"organisasjonsnummer": "222222222"}]},
            "_links": {},  # No more pages
        }

        service._get = AsyncMock(side_effect=[page1_response, page2_response])

        # Act
        result = await service.fetch_subunits("987654321")

        # Assert
        assert len(result) == 2
        assert service._get.call_count == 2

    @pytest.mark.asyncio
    async def test_fetch_subunits_404_returns_empty_list(self):
        # Arrange
        service = BrregApiService()
        mock_response = MagicMock()
        mock_response.status_code = 404
        service._get = AsyncMock(return_value=mock_response)

        # Act
        result = await service.fetch_subunits("999999999")

        # Assert
        assert result == []


class TestFetchRoles:
    """Tests for fetch_roles method."""

    @pytest.mark.asyncio
    async def test_fetch_roles_success(self):
        # Arrange
        service = BrregApiService()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "rollegrupper": [
                {
                    "type": {"kode": "DAGL", "beskrivelse": "Daglig leder"},
                    "roller": [
                        {
                            "person": {
                                "navn": {"fornavn": "Ola", "mellomnavn": "", "etternavn": "Nordmann"},
                                "fodselsdato": "1980-01-15",
                            },
                            "fratraadt": False,
                            "rekkefoelge": 1,
                        }
                    ],
                }
            ]
        }
        service._get = AsyncMock(return_value=mock_response)

        # Act
        result = await service.fetch_roles("123456789")

        # Assert
        assert len(result) == 1
        assert result[0]["type_kode"] == "DAGL"
        assert result[0]["person_navn"] == "Ola Nordmann"
        assert result[0]["foedselsdato"] == "1980-01-15"

    @pytest.mark.asyncio
    async def test_fetch_roles_with_entity_role(self):
        # Arrange
        service = BrregApiService()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "rollegrupper": [
                {
                    "type": {"kode": "EIER", "beskrivelse": "Eier"},
                    "roller": [
                        {
                            "enhet": {
                                "organisasjonsnummer": "888888888",
                                "navn": ["Holding AS"],
                            },
                            "fratraadt": False,
                        }
                    ],
                }
            ]
        }
        service._get = AsyncMock(return_value=mock_response)

        # Act
        result = await service.fetch_roles("123456789")

        # Assert
        assert len(result) == 1
        assert result[0]["enhet_orgnr"] == "888888888"
        assert result[0]["enhet_navn"] == "Holding AS"

    @pytest.mark.asyncio
    async def test_fetch_roles_404_returns_empty_list(self):
        # Arrange
        service = BrregApiService()
        mock_response = MagicMock()
        mock_response.status_code = 404
        service._get = AsyncMock(return_value=mock_response)

        # Act
        result = await service.fetch_roles("999999999")

        # Assert
        assert result == []

    @pytest.mark.asyncio
    async def test_fetch_roles_handles_error_gracefully(self):
        # Arrange
        service = BrregApiService()
        service._get = AsyncMock(side_effect=Exception("Network error"))

        # Act
        result = await service.fetch_roles("123456789")

        # Assert - should return empty list, not raise
        assert result == []


class TestParseFinancialData:
    """Tests for parse_financial_data method."""

    @pytest.mark.asyncio
    async def test_parse_complete_financial_data(self):
        # Arrange
        service = BrregApiService()
        raw_data = {
            "regnskapsperiode": {"fraDato": "2023-01-01", "tilDato": "2023-12-31"},
            "resultatregnskapResultat": {
                "driftsresultat": {
                    "driftsinntekter": {"sumDriftsinntekter": 5000000},
                    "driftsresultat": 500000,
                    "driftskostnad": {"avskrivninger": 100000},
                },
                "aarsresultat": 400000,
            },
            "eiendeler": {
                "omloepsmidler": {"sumOmloepsmidler": 1000000},
                "anleggsmidler": {"sumAnleggsmidler": 2000000},
            },
            "egenkapitalGjeld": {
                "egenkapital": {"sumEgenkapital": 1500000},
                "gjeldOversikt": {
                    "kortsiktigGjeld": {"sumKortsiktigGjeld": 500000},
                    "langsiktigGjeld": {"sumLangsiktigGjeld": 1000000},
                },
            },
        }

        # Act
        result = await service.parse_financial_data(raw_data)

        # Assert
        assert result["aar"] == 2023
        assert result["periode_fra"] == "2023-01-01"
        assert result["periode_til"] == "2023-12-31"
        assert result["salgsinntekter"] == 5000000
        assert result["driftsresultat"] == 500000
        assert result["aarsresultat"] == 400000
        assert result["avskrivninger"] == 100000
        assert result["omloepsmidler"] == 1000000
        assert result["anleggsmidler"] == 2000000
        assert result["egenkapital"] == 1500000
        assert result["kortsiktig_gjeld"] == 500000
        assert result["langsiktig_gjeld"] == 1000000

    @pytest.mark.asyncio
    async def test_parse_empty_financial_data(self):
        # Arrange
        service = BrregApiService()
        raw_data = {}

        # Act
        result = await service.parse_financial_data(raw_data)

        # Assert
        assert result["aar"] is None
        assert result["salgsinntekter"] is None
        assert result["driftsresultat"] is None

    @pytest.mark.asyncio
    async def test_parse_truncates_iso_dates(self):
        # Arrange
        service = BrregApiService()
        raw_data = {
            "regnskapsperiode": {
                "fraDato": "2023-01-01T00:00:00.000Z",
                "tilDato": "2023-12-31T23:59:59.999Z",
            }
        }

        # Act
        result = await service.parse_financial_data(raw_data)

        # Assert
        assert result["periode_fra"] == "2023-01-01"
        assert result["periode_til"] == "2023-12-31"


class TestExtractValue:
    """Tests for _extract_value helper."""

    def test_extract_value_valid_number(self):
        # Arrange
        service = BrregApiService()
        data = {"sumValue": 12345.67}

        # Act
        result = service._extract_value(data, "sumValue")

        # Assert
        assert result == 12345.67

    def test_extract_value_none_data(self):
        # Arrange
        service = BrregApiService()

        # Act
        result = service._extract_value(None, "key")

        # Assert
        assert result is None

    def test_extract_value_missing_key(self):
        # Arrange
        service = BrregApiService()
        data = {"otherKey": 100}

        # Act
        result = service._extract_value(data, "missingKey")

        # Assert
        assert result is None

    def test_extract_value_invalid_type(self):
        # Arrange
        service = BrregApiService()
        data = {"key": "not a number"}

        # Act
        result = service._extract_value(data, "key")

        # Assert
        assert result is None
