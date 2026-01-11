"""
Unit tests for GeocodingService.
"""
from unittest.mock import AsyncMock, patch, MagicMock
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
            "adresser": [{
                "representasjonspunkt": {"lat": 60.0, "lon": 11.0},
                "objtype": "Vegadresse"  # Priority 1
            }]
        }
        mock_req.return_value = mock_response
        
        result = await service.geocode_address("Storgata 1")
        
        assert result == (60.0, 11.0)
        mock_req.assert_called_once()
