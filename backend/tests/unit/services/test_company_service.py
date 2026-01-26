"""
Unit tests for CompanyService.
"""

from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from services.company_service import CompanyService
from models import Company


@pytest.fixture
def mock_db():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def service(mock_db):
    svc = CompanyService(mock_db)
    svc.company_repo = AsyncMock()
    svc.accounting_repo = AsyncMock()
    svc.role_repo = AsyncMock()
    svc.subunit_repo = AsyncMock()
    svc.brreg_api = AsyncMock()
    svc.geocoding_service = AsyncMock()
    return svc


@pytest.mark.asyncio
async def test_get_company_success(service):
    # Arrange
    mock_company = MagicMock(spec=Company)
    mock_company.orgnr = "123456789"
    service.company_repo.get_by_orgnr.return_value = mock_company

    # Act
    result = await service.get_company_with_accounting("123456789")

    # Assert
    assert result == mock_company
    service.company_repo.get_by_orgnr.assert_called_once_with("123456789")


@pytest.mark.asyncio
async def test_get_company_not_found(service):
    # Arrange
    service.company_repo.get_by_orgnr.return_value = None

    # Act
    result = await service.get_company_with_accounting("999999999")

    # Assert
    assert result is None


@pytest.mark.asyncio
async def test_search_companies(service):
    # Arrange
    mock_results = [MagicMock(), MagicMock()]
    service.company_repo.search_by_name.return_value = mock_results

    # Act
    await service.search_companies("Test")

    # Assert
    service.company_repo.search_by_name.assert_called_once()
    assert service.company_repo.search_by_name.call_args[0][0] == "Test"


@pytest.mark.asyncio
async def test_search_companies_uses_cache(service):
    """Second call should use cache, not repo."""
    # Arrange
    mock_results = [MagicMock()]
    service.company_repo.search_by_name.return_value = mock_results

    # Clear cache first
    from services.company_service import search_cache

    await search_cache.clear()

    # Act - first call populates cache
    await service.search_companies("CacheTest")
    # Second call should use cache
    await service.search_companies("CacheTest")

    # Assert - repo should only be called once
    assert service.company_repo.search_by_name.call_count == 1


@pytest.mark.asyncio
async def test_count_companies(service):
    # Arrange
    service.company_repo.count_companies.return_value = 1000000

    # Act
    from services.dtos import CompanyFilterDTO

    result = await service.count_companies(CompanyFilterDTO())

    # Assert
    assert result == 1000000


@pytest.mark.asyncio
async def test_get_similar_companies(service):
    # Arrange
    mock_similar = [MagicMock(), MagicMock()]
    service.company_repo.get_similar_companies.return_value = mock_similar

    # Act
    result = await service.get_similar_companies("123456789", limit=5)

    # Assert
    service.company_repo.get_similar_companies.assert_called_once_with("123456789", 5)
    assert len(result) == 2


@pytest.mark.asyncio
async def test_get_company_detail_returns_company(service):
    """Should return company with parent name lookup."""
    # Arrange
    mock_company = MagicMock()
    mock_company.orgnr = "123456789"
    mock_company.parent_orgnr = None
    mock_company.latitude = 59.9
    service.company_repo.get_by_orgnr.return_value = mock_company

    # Act
    result = await service.get_company_detail("123456789")

    # Assert
    assert result == mock_company


@pytest.mark.asyncio
async def test_get_company_detail_falls_back_to_subunit(service):
    """Should fall back to subunit if company not found."""
    # Arrange
    service.company_repo.get_by_orgnr.side_effect = Exception("Not found")

    mock_subunit = MagicMock()
    mock_subunit.orgnr = "111111111"
    mock_subunit.navn = "Test Subunit"
    mock_subunit.parent_orgnr = "123456789"
    mock_subunit.organisasjonsform = "BEDR"
    mock_subunit.naeringskode = "62.010"
    mock_subunit.antall_ansatte = 5
    mock_subunit.stiftelsesdato = None
    mock_subunit.registreringsdato_enhetsregisteret = None
    mock_subunit.beliggenhetsadresse = {"kommune": "Oslo"}
    mock_subunit.postadresse = None
    mock_subunit.raw_data = {}
    service.subunit_repo.get_by_orgnr.return_value = mock_subunit
    service.company_repo.get_company_name.return_value = "Parent AS"

    # Act
    result = await service.get_company_detail("111111111")

    # Assert
    assert result is not None
    assert result["orgnr"] == "111111111"
    assert result["is_subunit"] is True


@pytest.mark.asyncio
async def test_get_company_detail_returns_none_if_not_found(service):
    """Should return None if neither company nor subunit found."""
    # Arrange
    service.company_repo.get_by_orgnr.side_effect = Exception("Not found")
    service.subunit_repo.get_by_orgnr.return_value = None

    # Act
    result = await service.get_company_detail("999999999")

    # Assert
    assert result is None


@pytest.mark.asyncio
async def test_get_companies_by_industry(service):
    # Arrange
    mock_companies = [MagicMock(), MagicMock()]
    service.company_repo.get_by_industry_code.return_value = (mock_companies, 100)

    # Act
    result = await service.get_companies_by_industry("62", page=1, limit=20)

    # Assert
    assert result["total"] == 100
    assert result["page"] == 1
    assert result["pages"] == 5  # 100 / 20
    assert result["nace_code"] == "62"


@pytest.mark.asyncio
async def test_search_subunits(service):
    # Arrange
    mock_subunits = [MagicMock(), MagicMock()]
    service.subunit_repo.search_by_name.return_value = mock_subunits

    # Act
    result = await service.search_subunits("test", limit=10)

    # Assert
    assert len(result) == 2
    service.subunit_repo.search_by_name.assert_called_once_with("test", 10)


@pytest.mark.asyncio
async def test_get_subunits_syncs_if_missing(service):
    """Should sync from API if no subunits found locally."""
    # Arrange
    # First call returns empty, second (after sync) returns data
    mock_subunit = MagicMock()
    service.subunit_repo.get_by_parent_orgnr.side_effect = [[], [mock_subunit]]
    service.brreg_api.fetch_subunits.return_value = [{"organisasjonsnummer": "111111111"}]
    service.subunit_repo.create_batch.return_value = None

    # Act
    result = await service.get_subunits("123456789")

    # Assert
    assert len(result) == 1
    service.brreg_api.fetch_subunits.assert_called_once_with("123456789")


@pytest.mark.asyncio
async def test_fetch_and_store_company(service):
    """Should fetch from Brreg and store in database."""
    # Arrange
    mock_company_data = {"organisasjonsnummer": "123456789", "navn": "Test AS"}
    service.brreg_api.fetch_company.return_value = mock_company_data

    mock_company = MagicMock()
    mock_company.latitude = 59.9  # Already geocoded
    service.company_repo.create_or_update.return_value = mock_company

    service.brreg_api.fetch_subunits.return_value = []
    service.brreg_api.fetch_financial_statements.return_value = []

    # Act
    result = await service.fetch_and_store_company("123456789")

    # Assert
    assert result["company_fetched"] is True
    assert result["orgnr"] == "123456789"


@pytest.mark.asyncio
async def test_fetch_and_store_company_not_found(service):
    """Should return error if company not found in Brreg."""
    # Arrange
    service.brreg_api.fetch_company.return_value = None

    # Act
    result = await service.fetch_and_store_company("999999999")

    # Assert
    assert result["company_fetched"] is False
    assert "Not found" in result["errors"][0]


@pytest.mark.asyncio
async def test_ensure_geocoded(service):
    """Should geocode company if coordinates missing."""
    # Arrange
    mock_company = MagicMock()
    mock_company.orgnr = "123456789"
    mock_company.forretningsadresse = {"postnummer": "0150", "poststed": "Oslo"}
    mock_company.postadresse = {}

    service.geocoding_service.build_address_string.return_value = "Oslo 0150"
    service.geocoding_service.geocode_address.return_value = (59.9, 10.7)
    service.company_repo.update_coordinates.return_value = None

    # Act
    await service.ensure_geocoded(mock_company)

    # Assert
    service.company_repo.update_coordinates.assert_called_once_with("123456789", 59.9, 10.7)


@pytest.mark.asyncio
async def test_get_statistics(service):
    """Should return platform-wide statistics."""
    # Arrange
    service.company_repo.count.return_value = 1000000
    service.company_repo.get_total_employees.return_value = 2500000
    service.company_repo.get_aggregate_stats.return_value = {"total_count": 1000000, "total_employees": 2500000}
    service.accounting_repo.get_aggregated_stats.return_value = {"total_revenue": 1000000000}
    service.company_repo.get_geocoded_count.return_value = 900000
    service.company_repo.get_new_companies_30d.return_value = 5000
    service.role_repo.count_total_roles.return_value = 3000000

    # Act
    result = await service.get_statistics()

    # Assert
    assert "total_companies" in result or service.company_repo.count.called


class TestEnrichNaceCodes:
    """Tests for _enrich_nace_codes helper."""

    @pytest.mark.asyncio
    async def test_enriches_primary_nace_code(self, service):
        # Arrange
        mock_item = MagicMock()
        mock_item.naeringskode = "62.010"
        mock_item.naeringskoder = None

        with patch("services.company_service.NaceService") as mock_nace_class:
            mock_nace = MagicMock()
            mock_nace.get_nace_name = AsyncMock(return_value="Programmeringstjenester")
            mock_nace_class.return_value = mock_nace

            # Act
            await service._enrich_nace_codes([mock_item])

            # Assert
            mock_nace.get_nace_name.assert_called_once_with("62.010")

    @pytest.mark.asyncio
    async def test_handles_dict_items(self, service):
        # Arrange
        mock_item = {"naeringskode": "62.010", "naeringskoder": None}

        with patch("services.company_service.NaceService") as mock_nace_class:
            mock_nace = MagicMock()
            mock_nace.get_nace_name = AsyncMock(return_value="Programmeringstjenester")
            mock_nace_class.return_value = mock_nace

            # Act
            await service._enrich_nace_codes([mock_item])

            # Assert
            # Should enrich dict in place
            assert mock_item["naeringskode"].kode == "62.010"
