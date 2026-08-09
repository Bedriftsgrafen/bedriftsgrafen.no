"""
Unit tests for CompanyService.
"""

import asyncio
from contextlib import asynccontextmanager
from datetime import UTC, date, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

import services.company_service as company_service_module
from models import Company
from services.base_external_service import ExternalApiException
from services.company_service import CompanyService
from services.subunit_refresh_lock import SubunitRefreshLockConfig


@pytest.fixture
def mock_db():
    return AsyncMock(spec=AsyncSession)


@pytest.fixture
def service(mock_db, monkeypatch):
    class FakeSubunitRefreshLock:
        key = "brreg:subunits:refresh:123456789"
        token = "test-lock-token"  # noqa: S105

    async def fake_try_acquire_subunit_refresh_lock(parent_orgnr, *, config=None):
        return FakeSubunitRefreshLock()

    @asynccontextmanager
    async def fake_maintain_subunit_refresh_lock(lock, *, config=None):
        yield

    monkeypatch.setattr(
        company_service_module,
        "try_acquire_subunit_refresh_lock",
        fake_try_acquire_subunit_refresh_lock,
    )
    monkeypatch.setattr(
        company_service_module,
        "maintain_subunit_refresh_lock",
        fake_maintain_subunit_refresh_lock,
    )
    monkeypatch.setattr(company_service_module.count_cache, "get", AsyncMock(return_value=None))
    monkeypatch.setattr(company_service_module.count_cache, "set", AsyncMock())
    monkeypatch.setattr(company_service_module.stats_cache, "get", AsyncMock(return_value=None))
    monkeypatch.setattr(company_service_module.stats_cache, "set", AsyncMock())

    svc = CompanyService(mock_db)
    svc.company_repo = AsyncMock()
    svc.accounting_repo = AsyncMock()
    svc.event_repo = AsyncMock()
    svc.event_ledger_enabled = False
    svc.role_repo = AsyncMock()
    svc.subunit_repo = AsyncMock()
    svc.subunit_repo.is_cache_valid.return_value = False
    svc.subunit_repo.parent_company_exists.return_value = True
    svc.subunit_repo.get_refresh_timestamp.return_value = None
    svc.subunit_repo.create_batch.return_value = 1
    svc.subunit_repo.mark_cache_refreshed.return_value = 1
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
async def test_get_company_detail_sorts_accounting_history(service):
    mock_company = MagicMock()
    mock_company.orgnr = "123456789"
    mock_company.parent_orgnr = None
    mock_company.latitude = 59.9
    old_null_period = MagicMock(id=1, aar=2025, periode_fra=None, periode_til=None)
    newer_period = MagicMock(id=2, aar=2025, periode_fra=date(2024, 8, 16), periode_til=date(2025, 6, 30))
    previous_year = MagicMock(id=3, aar=2024, periode_fra=None, periode_til=date(2024, 12, 31))
    dec_31_fallback = MagicMock(id=4, aar=2025, periode_fra=None, periode_til=date(2025, 12, 31))
    mock_company.regnskap = [previous_year, old_null_period, dec_31_fallback, newer_period]
    service.company_repo.get_by_orgnr.return_value = mock_company

    result = await service.get_company_detail("123456789")

    assert result.regnskap == [newer_period, dec_31_fallback, old_null_period, previous_year]


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
    mock_subunit = MagicMock()
    service.subunit_repo.get_by_parent_orgnr.return_value = [mock_subunit]
    service.brreg_api.fetch_subunits.return_value = [{"organisasjonsnummer": "111111111"}]
    service.subunit_repo.create_batch.return_value = 1

    # Act
    result = await service.get_subunits("123456789")

    # Assert
    assert len(result) == 1
    service.brreg_api.fetch_subunits.assert_called_once_with("123456789")
    service.subunit_repo.mark_cache_refreshed.assert_called_once_with("123456789", commit=True)


@pytest.mark.asyncio
async def test_get_subunits_reuses_negative_cache(service):
    service.subunit_repo.is_cache_valid.side_effect = [False, False, True]
    service.subunit_repo.get_by_parent_orgnr.return_value = []
    service.brreg_api.fetch_subunits.return_value = []

    first = await service.get_subunits("123456789")
    second = await service.get_subunits("123456789")

    assert first == []
    assert second == []
    service.brreg_api.fetch_subunits.assert_called_once_with("123456789")
    service.subunit_repo.mark_cache_refreshed.assert_called_once_with("123456789", commit=True)


@pytest.mark.asyncio
async def test_get_subunits_unknown_local_parent_does_not_proxy_to_brreg(service):
    service.subunit_repo.parent_company_exists.return_value = False

    result = await service.get_subunits("999999999")

    assert result == []
    service.brreg_api.fetch_subunits.assert_not_called()
    service.subunit_repo.mark_cache_refreshed.assert_not_called()


@pytest.mark.asyncio
async def test_get_subunits_force_refresh_uses_server_side_cooldown(service):
    cached_subunit = MagicMock()
    service.subunit_repo.get_refresh_timestamp.return_value = datetime.now(UTC) - timedelta(seconds=10)
    service.subunit_repo.get_by_parent_orgnr.return_value = [cached_subunit]

    result = await service.get_subunits("123456789", force_refresh=True)

    assert result == [cached_subunit]
    service.brreg_api.fetch_subunits.assert_not_called()


@pytest.mark.asyncio
async def test_get_subunits_upstream_error_returns_stale_cache(service):
    stale_subunit = MagicMock()
    service.subunit_repo.get_by_parent_orgnr.return_value = [stale_subunit]
    service.brreg_api.fetch_subunits.side_effect = ExternalApiException(
        message="Timeout fetching subunits",
        service="Brønnøysund",
        details="timeout",
    )

    result = await service.get_subunits("123456789")

    assert result == [stale_subunit]
    service.subunit_repo.mark_cache_refreshed.assert_not_called()


@pytest.mark.asyncio
async def test_get_subunits_upstream_error_without_cache_raises(service):
    service.subunit_repo.get_by_parent_orgnr.return_value = []
    service.brreg_api.fetch_subunits.side_effect = ExternalApiException(
        message="Timeout fetching subunits",
        service="Brønnøysund",
        details="timeout",
    )

    with pytest.raises(ExternalApiException):
        await service.get_subunits("123456789")

    service.subunit_repo.mark_cache_refreshed.assert_not_called()


@pytest.mark.asyncio
async def test_get_subunits_parse_error_does_not_mark_success(service, monkeypatch):
    service.subunit_repo.get_by_parent_orgnr.return_value = []
    service.brreg_api.fetch_subunits.return_value = [{"organisasjonsnummer": "111111111"}]

    def raise_parse_error(data, parent_orgnr):
        raise ValueError("bad subunit payload")

    monkeypatch.setattr(company_service_module, "map_subunit_from_api", raise_parse_error)

    with pytest.raises(ExternalApiException):
        await service.get_subunits("123456789")

    service.subunit_repo.create_batch.assert_not_called()
    service.subunit_repo.mark_cache_refreshed.assert_not_called()


@pytest.mark.asyncio
async def test_get_subunits_concurrent_same_parent_single_flight(service, monkeypatch):
    cache_valid = False
    saved_rows = []
    lock_taken = False

    class FakeLock:
        key = "brreg:subunits:refresh:123456789"
        token = "test-lock-token"  # noqa: S105

    async def fake_is_cache_valid(parent_orgnr):
        return cache_valid

    async def fake_get_by_parent(parent_orgnr):
        return saved_rows

    async def fake_create_batch(subunits, commit=True):
        saved_rows[:] = subunits
        return len(subunits)

    async def fake_mark_cache_refreshed(parent_orgnr, commit=True):
        nonlocal cache_valid
        cache_valid = True
        return 1

    async def fake_fetch_subunits(parent_orgnr):
        await asyncio.sleep(0.05)
        return [{"organisasjonsnummer": "111111111", "navn": "Avdeling"}]

    async def fake_try_acquire(parent_orgnr, *, config=None):
        nonlocal lock_taken
        if lock_taken:
            return None
        lock_taken = True
        return FakeLock()

    monkeypatch.setattr(company_service_module, "try_acquire_subunit_refresh_lock", fake_try_acquire)
    monkeypatch.setattr(
        company_service_module,
        "load_subunit_refresh_lock_config",
        lambda: SubunitRefreshLockConfig(
            ttl_seconds=10,
            wait_timeout_seconds=1.0,
            poll_interval_seconds=0.01,
            redis_timeout_seconds=0.1,
        ),
    )
    service.subunit_repo.is_cache_valid.side_effect = fake_is_cache_valid
    service.subunit_repo.get_by_parent_orgnr.side_effect = fake_get_by_parent
    service.subunit_repo.create_batch.side_effect = fake_create_batch
    service.subunit_repo.mark_cache_refreshed.side_effect = fake_mark_cache_refreshed
    service.brreg_api.fetch_subunits.side_effect = fake_fetch_subunits

    first, second = await asyncio.gather(
        service.get_subunits("123456789"),
        service.get_subunits("123456789"),
    )

    assert len(first) == 1
    assert len(second) == 1
    service.brreg_api.fetch_subunits.assert_awaited_once_with("123456789")


@pytest.mark.asyncio
async def test_get_subunits_different_parents_refresh_independently(service):
    service.subunit_repo.get_by_parent_orgnr.return_value = []
    service.brreg_api.fetch_subunits.return_value = []

    await service.get_subunits("123456789")
    await service.get_subunits("987654321")

    assert service.brreg_api.fetch_subunits.await_count == 2
    service.brreg_api.fetch_subunits.assert_any_await("123456789")
    service.brreg_api.fetch_subunits.assert_any_await("987654321")


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
    assert result["financials_fetched"] == 0
    service.company_repo.update_last_polled_regnskap.assert_called_once_with("123456789")
    service.db.commit.assert_called_once()


@pytest.mark.asyncio
async def test_fetch_and_store_company_not_found(service):
    """Should return error if company not found in Brreg."""
    # Arrange
    service.brreg_api.fetch_company.return_value = None

    # Act
    result = await service.fetch_and_store_company("999999999")

    # Assert
    assert result["company_fetched"] is False
    assert result["error_code"] is None
    assert "Brønnøysund" in result["errors"][0]


@pytest.mark.asyncio
async def test_fetch_and_store_company_brreg_fetch_failure_returns_stable_error(service):
    """Should return a stable Brreg error code when the primary source fetch fails."""
    service.brreg_api.fetch_company.side_effect = ExternalApiException(
        message="Timeout fetching company 123456789",
        service="Brønnøysund",
        details="Failed after 3 attempts",
    )

    result = await service.fetch_and_store_company("123456789")

    assert result["company_fetched"] is False
    assert result["error_code"] == "BRREG_API_ERROR"
    assert result["errors"] == ["Kunne ikke hente data fra Brønnøysundregistrene akkurat nå."]


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
        {"regnskapsperiode": {"tilDato": "2024-12-31"}, "resultatregnskapResultat": {}},
        {"resultatregnskapResultat": {}},
    ]
    service.brreg_api.parse_financial_data.side_effect = [
        {"aar": 2024, "periode_til": "2024-12-31", "aarsresultat": 1000},
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
    service.brreg_api.parse_financial_data.assert_awaited()
    service.accounting_repo.create_or_update.assert_awaited_once_with(
        "123456789",
        {"aar": 2024, "periode_til": "2024-12-31", "aarsresultat": 1000},
        raw_data={"regnskapsperiode": {"tilDato": "2024-12-31"}, "resultatregnskapResultat": {}},
    )
    service.company_repo.update_last_polled_regnskap.assert_called_once_with("123456789")
    service.db.commit.assert_called_once()


@pytest.mark.asyncio
@patch("services.role_service.RoleService")
async def test_fetch_and_store_company_financial_fetch_failure_returns_stable_error(MockRoleService, service):
    """Should keep the company result but expose a stable Brreg code for financial source errors."""
    mock_company_data = {"organisasjonsnummer": "123456789", "navn": "Test AS"}
    service.brreg_api.fetch_company.return_value = mock_company_data

    mock_company = MagicMock()
    mock_company.latitude = 59.9
    service.company_repo.create_or_update.return_value = mock_company

    service.brreg_api.fetch_subunits.return_value = []
    service.brreg_api.fetch_financial_statements.side_effect = ExternalApiException(
        message="Unexpected response shape for financials 123456789",
        service="Brønnøysund",
        details="Expected list, got dict",
    )

    mock_role_instance = AsyncMock()
    MockRoleService.return_value = mock_role_instance

    result = await service.fetch_and_store_company("123456789")

    assert result["company_fetched"] is True
    assert result["financials_fetched"] == 0
    assert result["error_code"] == "BRREG_API_ERROR"
    assert result["errors"] == ["Kunne ikke hente regnskap fra Brønnøysund akkurat nå."]


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
