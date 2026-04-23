"""
Unit tests for CompanyService.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

import services.company_service as company_service_module
from models import Company
from services.company_service import CompanyService


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
async def test_get_similar_companies_logs_slow_request(service, monkeypatch, caplog):
    """Should emit a warning when similar lookup exceeds slow threshold."""
    mock_similar = [MagicMock()]
    service.company_repo.get_similar_companies.return_value = mock_similar
    monkeypatch.setattr(company_service_module, "SIMILAR_SLOW_LOG_THRESHOLD_MS", 0)

    from services.company_service import _similar_in_flight, similar_cache

    _similar_in_flight.clear()
    await similar_cache.clear()

    with caplog.at_level("WARNING"):
        await service.get_similar_companies("123456789", limit=5)

    assert any("similar.companies.slow" in rec.message for rec in caplog.records)


@pytest.mark.asyncio
async def test_get_similar_companies_does_not_log_when_fast(service, monkeypatch, caplog):
    """Should not emit slow warning when threshold is high and request is fast."""
    mock_similar = [MagicMock()]
    service.company_repo.get_similar_companies.return_value = mock_similar
    monkeypatch.setattr(company_service_module, "SIMILAR_SLOW_LOG_THRESHOLD_MS", 60_000)

    from services.company_service import _similar_in_flight, similar_cache

    _similar_in_flight.clear()
    await similar_cache.clear()

    with caplog.at_level("WARNING"):
        await service.get_similar_companies("123456789", limit=5)

    assert not any("similar.companies.slow" in rec.message for rec in caplog.records)


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
@patch("services.role_service.RoleService")
async def test_fetch_and_store_company(MockRoleService, service):
    """Should fetch from Brreg and store in database."""
    # Arrange
    mock_company_data = {"organisasjonsnummer": "123456789", "navn": "Test AS"}
    service.brreg_api.fetch_company.return_value = mock_company_data

    mock_company = MagicMock()
    mock_company.latitude = 59.9  # Already geocoded
    service.company_repo.create_or_update.return_value = mock_company

    service.brreg_api.fetch_subunits.return_value = []
    service.brreg_api.fetch_financial_statements.return_value = []

    # Mock RoleService to avoid unawaited coroutine warning
    mock_role_instance = AsyncMock()
    MockRoleService.return_value = mock_role_instance

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
    assert "Brønnøysund" in result["errors"][0]


@pytest.mark.asyncio
@patch("services.role_service.RoleService")
async def test_fetch_and_store_company_skips_invalid_financial_statements(MockRoleService, service):
    """Should save valid financial statements and skip invalid ones (missing aar)."""
    from exceptions import ValidationException

    mock_company_data = {"organisasjonsnummer": "123456789", "navn": "Test AS"}
    service.brreg_api.fetch_company.return_value = mock_company_data

    mock_company = MagicMock()
    mock_company.latitude = 59.9
    service.company_repo.create_or_update.return_value = mock_company

    service.brreg_api.fetch_subunits.return_value = []
    service.brreg_api.fetch_financial_statements.return_value = [
        {"aar": 2024, "aarsresultat": 1000},
        {"aarsresultat": 500},
    ]

    service.accounting_repo.create_or_update.side_effect = [
        None,
        ValidationException("Financial data must include accounting year (aar)"),
    ]

    mock_role_instance = AsyncMock()
    MockRoleService.return_value = mock_role_instance

    result = await service.fetch_and_store_company("123456789")

    assert result["company_fetched"] is True
    assert result["financials_fetched"] == 1
    assert result["financials_skipped"] == 1
    assert any("manglet regnskapsår" in msg for msg in result["errors"])
    service.company_repo.update_last_polled_regnskap.assert_called_once_with("123456789")
    service.db.commit.assert_called_once()


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
async def test_get_statistics(service, mock_db):
    """Should return platform-wide statistics from company_totals ORM model."""
    # Arrange
    mock_row = MagicMock()
    mock_row.total_count = 1000000
    mock_row.total_roles = 3000000
    mock_row.total_employees = 2500000
    mock_row.geocoded_count = 900000
    mock_row.new_companies_30d = 5000
    mock_row.total_revenue = 1000000000.0
    mock_row.total_ebitda = 50000000.0
    mock_row.profitable_percentage = 65.5
    mock_row.solid_company_percentage = 42.0
    mock_row.avg_operating_margin = 12.5

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_row
    mock_db.execute.return_value = mock_result

    # Act
    result = await service.get_statistics()

    # Assert
    assert result["total_companies"] == 1000000
    assert result["total_roles"] == 3000000
    assert result["total_revenue"] == 1000000000.0
    mock_db.execute.assert_called_once()
    # Verify it queries the CompanyTotals model (company_totals table)
    args = mock_db.execute.call_args[0][0]
    assert "company_totals" in str(args)


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
            await service.enrich_nace_codes([mock_item])

            # Assert
            mock_nace.get_nace_name.assert_called_once_with("62.010")

    @pytest.mark.asyncio
    async def test_handles_dict_items(self, service):
        # Arrange
        mock_item = {"naeringskode": "62.010", "naeringskoder": None}

        with patch("services.company_service.NaceService") as mock_nace_class:
            mock_nace = AsyncMock()
            mock_nace.get_nace_name = AsyncMock(return_value="Programmeringstjenester")
            mock_nace_class.return_value = mock_nace

            # Act
            await service.enrich_nace_codes([mock_item])

            # Assert
            # Should enrich dict in place
            assert mock_item["naeringskode"].kode == "62.010"


class TestBackgroundParentSync:
    """Tests for _background_parent_sync session isolation."""

    @pytest.mark.asyncio
    async def test_uses_independent_session(self, service):
        """Background sync must create its own session, not reuse the request session."""
        # Arrange
        mock_bg_session = AsyncMock()

        with patch("services.company_service.AsyncSessionLocal") as mock_session_factory:
            # AsyncSessionLocal() returns a context manager that yields bg_session
            mock_session_factory.return_value.__aenter__ = AsyncMock(return_value=mock_bg_session)
            mock_session_factory.return_value.__aexit__ = AsyncMock(return_value=False)

            # Mock fetch_and_store_company on the bg_service that will be created
            with patch.object(CompanyService, "fetch_and_store_company", new_callable=AsyncMock) as mock_fetch:
                mock_fetch.return_value = {"orgnr": "987654321", "company_fetched": True}

                # Act
                await service._background_parent_sync("987654321")

            # Assert — AsyncSessionLocal was called (new session created)
            mock_session_factory.assert_called_once()

    @pytest.mark.asyncio
    async def test_deduplicates_concurrent_syncs(self, service):
        """Concurrent syncs for the same orgnr should be skipped."""
        # Arrange — pretend this orgnr is already syncing
        CompanyService._syncing_orgnrs.add("111111111")

        with patch("services.company_service.AsyncSessionLocal") as mock_session_factory:
            # Act
            await service._background_parent_sync("111111111")

            # Assert — no session created because it was deduplicated
            mock_session_factory.assert_not_called()

        # Cleanup
        CompanyService._syncing_orgnrs.discard("111111111")

    @pytest.mark.asyncio
    async def test_cleans_up_syncing_set_on_error(self, service):
        """_syncing_orgnrs is cleaned up even when sync fails."""
        # Arrange
        with patch("services.company_service.AsyncSessionLocal") as mock_session_factory:
            mock_bg_session = AsyncMock()
            mock_session_factory.return_value.__aenter__ = AsyncMock(return_value=mock_bg_session)
            mock_session_factory.return_value.__aexit__ = AsyncMock(return_value=False)

            with patch.object(
                CompanyService, "fetch_and_store_company", new_callable=AsyncMock, side_effect=RuntimeError("DB error")
            ):
                # Act
                await service._background_parent_sync("222222222")

        # Assert — orgnr removed from set despite error
        assert "222222222" not in CompanyService._syncing_orgnrs
