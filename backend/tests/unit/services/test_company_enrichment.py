from unittest.mock import AsyncMock, patch

import pytest

from schemas.companies import Naeringskode
from services.company_service import CompanyService


@pytest.fixture
def service():
    return CompanyService(AsyncMock())


@pytest.mark.asyncio
async def test_enrich_nace_codes_dict(service):
    # Arrange
    items = [{"naeringskode": "62.010", "naeringskoder": ["62.010", "62.020"]}]

    with patch("services.nace_service.NaceService.get_nace_name", side_effect=lambda x: f"Name for {x}"):
        # Act
        await service.enrich_nace_codes(items)

    # Assert
    assert items[0]["naeringskode"] == Naeringskode(kode="62.010", beskrivelse="Name for 62.010")
    assert items[0]["naeringskoder"] == [
        Naeringskode(kode="62.010", beskrivelse="Name for 62.010"),
        Naeringskode(kode="62.020", beskrivelse="Name for 62.020"),
    ]


@pytest.mark.asyncio
async def test_enrich_nace_codes_mixed_types(service):
    # Test with objects (simulating ORM model behavior)
    class MockObj:
        def __init__(self, code, codes):
            self.naeringskode = code
            self.naeringskoder = codes

    items = [MockObj("62.010", ["62.010"])]

    with patch("services.nace_service.NaceService.get_nace_name", return_value="Test Industry"):
        await service.enrich_nace_codes(items)

    # Enriched values are stored in __dict__ to avoid overwriting ORM columns/properties
    assert items[0].__dict__["_enriched_naeringskode"] == Naeringskode(kode="62.010", beskrivelse="Test Industry")
    assert items[0].__dict__["_enriched_naeringskoder"] == [Naeringskode(kode="62.010", beskrivelse="Test Industry")]


def test_company_base_picks_up_enriched_naeringskoder():
    """CompanyBase model validator should pick up _enriched_naeringskoder from __dict__."""
    from schemas.companies import CompanyBase

    class MockObj:
        def __init__(self):
            self.orgnr = "123456789"
            self.navn = "Test AS"
            self.naeringskode = "62.010"
            self.naeringskoder = ["62.010"]
            # Simulate enrichment (set by enrich_nace_codes)
            self._enriched_naeringskode = Naeringskode(kode="62.010", beskrivelse="Programmering")
            self._enriched_naeringskoder = [Naeringskode(kode="62.010", beskrivelse="Programmering")]

    result = CompanyBase.model_validate(MockObj(), from_attributes=True)
    assert isinstance(result.naeringskode, Naeringskode)
    assert result.naeringskode.beskrivelse == "Programmering"
    assert len(result.naeringskoder) == 1
    assert isinstance(result.naeringskoder[0], Naeringskode)
    assert result.naeringskoder[0].beskrivelse == "Programmering"


def test_company_base_falls_back_to_raw_naeringskoder():
    """Without enrichment, naeringskoder should be raw strings."""
    from schemas.companies import CompanyBase

    class MockObj:
        def __init__(self):
            self.orgnr = "123456789"
            self.navn = "Test AS"
            self.naeringskode = "62.010"
            self.naeringskoder = ["62.010"]

    result = CompanyBase.model_validate(MockObj(), from_attributes=True)
    assert result.naeringskode == "62.010"
    assert result.naeringskoder == ["62.010"]
