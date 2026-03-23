"""
Unit tests for GeocodingService.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.geocoding_service import GeocodingService


@pytest.mark.asyncio
async def test_geocode_with_override():
    service = GeocodingService()
    # Inject override
    orgnr = "999999999"
    service.GEOCODING_OVERRIDES = {orgnr: (59.0, 10.0)}

    # Act
    result = await service.geocode_address("Some Address", orgnr=orgnr)

    # Assert
    assert result == (59.0, 10.0)


@pytest.mark.asyncio
async def test_geocode_no_address():
    service = GeocodingService()
    result = await service.geocode_address(None)
    assert result is None

    result = await service.geocode_address(" ")
    assert result is None


@pytest.mark.asyncio
async def test_geocode_api_call_success():
    service = GeocodingService()

    with patch.object(service, "_get", new_callable=AsyncMock) as mock_req:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "adresser": [
                {
                    "representasjonspunkt": {"lat": 60.0, "lon": 11.0},
                    "objtype": "Vegadresse",  # Priority 1
                }
            ]
        }
        mock_req.return_value = mock_response

        result = await service.geocode_address("Storgata 1")

        assert result == (60.0, 11.0)
        mock_req.assert_called_once()


@pytest.mark.asyncio
async def test_geocode_fallback_to_gateadresse():
    """Should fall back to Gateadresse when no Vegadresse exists."""
    service = GeocodingService()

    with patch.object(service, "_get", new_callable=AsyncMock) as mock_req:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "adresser": [
                {
                    "representasjonspunkt": {"lat": 59.5, "lon": 10.5},
                    "objtype": "Gateadresse",  # Priority 2
                }
            ]
        }
        mock_req.return_value = mock_response

        result = await service.geocode_address("Gamlegata 5")

        assert result == (59.5, 10.5)


@pytest.mark.asyncio
async def test_geocode_skips_eiendom_only():
    """Should return None when only Eiendom results (often in ocean)."""
    service = GeocodingService()

    with patch.object(service, "_get", new_callable=AsyncMock) as mock_req:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "adresser": [
                {
                    "representasjonspunkt": {"lat": 61.0, "lon": 5.0},
                    "objtype": "Eiendom",  # Dangerous - skipped
                }
            ]
        }
        mock_req.return_value = mock_response

        result = await service.geocode_address("Fjordveien 10")

        assert result is None


@pytest.mark.asyncio
async def test_geocode_retry_without_zip():
    """Should retry without zip code if initial search returns empty."""
    service = GeocodingService()

    call_count = [0]

    async def mock_get(*args, **kwargs):
        call_count[0] += 1
        mock_response = MagicMock()
        mock_response.status_code = 200

        if call_count[0] == 1:
            # First call with zip returns empty
            mock_response.json.return_value = {"adresser": []}
        else:
            # Second call without zip returns result
            mock_response.json.return_value = {
                "adresser": [{"representasjonspunkt": {"lat": 60.0, "lon": 10.0}, "objtype": "Vegadresse"}]
            }
        return mock_response

    with patch.object(service, "_get", side_effect=mock_get):
        result = await service.geocode_address("Storgata 1, 0000 Oslo")

        assert result == (60.0, 10.0)
        assert call_count[0] == 2


@pytest.mark.asyncio
async def test_geocode_handles_api_error():
    """Should return None on API exception."""
    from services.base_external_service import ExternalApiException

    service = GeocodingService()

    with patch.object(service, "_get", new_callable=AsyncMock) as mock_req:
        mock_req.side_effect = ExternalApiException("Kartverket", "API down")

        result = await service.geocode_address("Storgata 1")

        assert result is None


class TestExtractMethods:
    """Tests for static helper methods."""

    def test_extract_zip_code_valid(self):
        assert GeocodingService._extract_zip_code("Storgata 1, 0150 Oslo") == "0150"
        assert GeocodingService._extract_zip_code("0150 Oslo") == "0150"
        assert GeocodingService._extract_zip_code("Nygata 5, 4876 Grimstad") == "4876"

    def test_extract_zip_code_invalid(self):
        assert GeocodingService._extract_zip_code("Storgata 1") is None
        assert GeocodingService._extract_zip_code("No zip here") is None

    def test_extract_street_and_number(self):
        assert GeocodingService._extract_street_and_number("Storgata 1, 0150 Oslo") == "Storgata 1"
        assert GeocodingService._extract_street_and_number("Kongens gate 45B, 0153 Oslo") == "Kongens gate 45B"

    def test_extract_street_and_number_no_match(self):
        assert GeocodingService._extract_street_and_number("0150 Oslo") is None

    def test_extract_coords_valid(self):
        hit = {"representasjonspunkt": {"lat": 59.9, "lon": 10.7}}
        assert GeocodingService._extract_coords(hit) == (59.9, 10.7)

    def test_extract_coords_missing(self):
        assert GeocodingService._extract_coords({}) == (None, None)
        assert GeocodingService._extract_coords({"representasjonspunkt": {}}) == (None, None)


class TestBuildAddressString:
    """Tests for build_address_string static method."""

    def test_builds_full_address(self):
        addr = {
            "adresse": ["Storgata 1"],
            "postnummer": "0150",
            "poststed": "OSLO",
        }
        result = GeocodingService.build_address_string(addr)
        assert result == "Storgata 1, 0150 OSLO"

    def test_skips_co_lines(self):
        addr = {
            "adresse": ["c/o Ola Nordmann", "Storgata 1"],
            "postnummer": "0150",
            "poststed": "OSLO",
        }
        result = GeocodingService.build_address_string(addr)
        assert result == "Storgata 1, 0150 OSLO"

    def test_skips_postboks(self):
        addr = {
            "adresse": ["Postboks 123", "Storgata 1"],
            "postnummer": "0150",
            "poststed": "OSLO",
        }
        result = GeocodingService.build_address_string(addr)
        assert result == "Storgata 1, 0150 OSLO"

    def test_returns_none_for_empty(self):
        assert GeocodingService.build_address_string(None, None) is None
        assert GeocodingService.build_address_string({}) is None

    def test_only_poststed(self):
        addr = {"poststed": "OSLO"}
        result = GeocodingService.build_address_string(addr)
        assert result == "OSLO"

    def test_uses_postadresse_fallback(self):
        postadresse = {
            "adresse": ["Postgate 5"],
            "postnummer": "0200",
            "poststed": "OSLO",
        }
        result = GeocodingService.build_address_string(None, postadresse)
        assert result == "Postgate 5, 0200 OSLO"
