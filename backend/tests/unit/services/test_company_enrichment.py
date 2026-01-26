import pytest
from unittest.mock import AsyncMock, patch
from services.company_service import CompanyService
from services.response_models import Naeringskode


@pytest.fixture
def service():
    return CompanyService(AsyncMock())


@pytest.mark.asyncio
async def test_enrich_nace_codes_dict(service):
    # Arrange
    items = [{"naeringskode": "62.010", "naeringskoder": ["62.010", "62.020"]}]

    with patch("services.nace_service.NaceService.get_nace_name", side_effect=lambda x: f"Name for {x}"):
        # Act
        await service._enrich_nace_codes(items)

    # Assert
    assert items[0]["naeringskode"] == Naeringskode(kode="62.010", beskrivelse="Name for 62.010")
    assert items[0]["naeringskoder"] == [
        Naeringskode(kode="62.010", beskrivelse="Name for 62.010"),
        Naeringskode(kode="62.020", beskrivelse="Name for 62.020"),
    ]


@pytest.mark.asyncio
async def test_enrich_nace_codes_mixed_types(service):
    # Test with objects
    class MockObj:
        def __init__(self, code, codes):
            self.naeringskode = code
            self.naeringskoder = codes

    items = [MockObj("62.010", ["62.010"])]

    with patch("services.nace_service.NaceService.get_nace_name", return_value="Test Industry"):
        await service._enrich_nace_codes(items)

    assert items[0].naeringskode == Naeringskode(kode="62.010", beskrivelse="Test Industry")
    assert items[0].naeringskoder == [Naeringskode(kode="62.010", beskrivelse="Test Industry")]
