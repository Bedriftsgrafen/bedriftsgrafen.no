"""
Unit tests for UpdateService.

Tests incremental update fetching and processing phases.
Follows AAA pattern (Arrange - Act - Assert).
"""

from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from schemas.brreg import FetchResult, UpdateBatchResult
from services.update_service import UpdateService


class NoopAsyncContext:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_value, traceback):
        return False


@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.add = MagicMock()  # session.add is sync
    return db


@pytest.fixture
def update_service(mock_db):
    service = UpdateService(mock_db)
    service.brreg_api = AsyncMock()
    service.subunit_repo = AsyncMock()
    service.role_repo = AsyncMock()
    service.system_repo = AsyncMock()
    service.company_repo = AsyncMock()
    service._get_existing_employee_counts = AsyncMock(return_value={})
    return service


class TestUpdateServiceInit:
    """Tests for UpdateService initialization."""

    def test_init_sets_repositories(self, mock_db):
        service = UpdateService(mock_db)
        assert service.db == mock_db
        assert service.brreg_api is not None
        assert service.company_repo is not None
        assert service.subunit_repo is not None
        assert service.role_repo is not None
        assert service.event_repo is not None
        assert service.event_ledger_enabled is False


@pytest.mark.asyncio
async def test_record_company_event_safe_skips_when_disabled(update_service, mock_db):
    update_service.event_ledger_enabled = False
    update_service.event_repo = AsyncMock()

    await update_service._record_company_event_safe(
        orgnr="123456789",
        event_type="accounting_added",
        source="Regnskapsregisteret via Brreg",
    )

    update_service.event_repo.record_event.assert_not_called()
    mock_db.begin_nested.assert_not_called()


@pytest.mark.asyncio
async def test_record_company_event_safe_writes_inside_savepoint_when_enabled(update_service, mock_db):
    update_service.event_ledger_enabled = True
    update_service.event_repo = AsyncMock()
    mock_db.begin_nested = MagicMock(return_value=NoopAsyncContext())

    await update_service._record_company_event_safe(
        orgnr="123456789",
        event_type="accounting_added",
        source="Regnskapsregisteret via Brreg",
        source_update_id="journal-1",
        new_value={"aar": 2025},
    )

    mock_db.begin_nested.assert_called_once()
    update_service.event_repo.record_event.assert_awaited_once_with(
        orgnr="123456789",
        event_type="accounting_added",
        source="Regnskapsregisteret via Brreg",
        source_update_id="journal-1",
        occurred_at=None,
        previous_value=None,
        new_value={"aar": 2025},
        payload=None,
    )


class TestFetchUpdates:
    """Tests for the main update fetching workflow."""

    @pytest.mark.asyncio
    async def test_fetch_updates_defaults_to_yesterday(self, update_service):
        update_service._process_single_page = AsyncMock(return_value=None)

        with patch("services.update_service.UpdateBatchResult") as mock_result_class:
            await update_service.fetch_updates()
            yesterday = date.today() - timedelta(days=1)
            mock_result_class.assert_called_once()
            _, kwargs = mock_result_class.call_args
            assert kwargs["since_date"] == yesterday

    @pytest.mark.asyncio
    async def test_fetch_updates_processes_multiple_pages(self, update_service):
        update_service._process_single_page = AsyncMock(side_effect=["http://next", None])

        with patch("httpx.AsyncClient"):
            result = await update_service.fetch_updates(page_size=1)
            assert update_service._process_single_page.call_count == 2
            assert result["companies_processed"] == 0


@pytest.mark.asyncio
async def test_persist_chunk_sorts_orgnrs(update_service):
    update_service._fetch_and_persist_financials = AsyncMock()

    company = MagicMock()
    company.last_polled_regnskap = date.today()
    update_service.company_repo.create_or_update = AsyncMock(return_value=company)

    fetch_results = [
        FetchResult(orgnr="999999999", success=True, company_data={"organisasjonsnummer": "999999999"}),
        FetchResult(orgnr="111111111", success=True, company_data={"organisasjonsnummer": "111111111"}),
        FetchResult(orgnr="555555555", success=True, company_data={"organisasjonsnummer": "555555555"}),
    ]

    result = UpdateBatchResult(since_date=date.today(), since_iso="2026-01-26T00:00:00.000Z")

    await update_service._persist_chunk(fetch_results, result)

    called_orgnrs = [
        call.args[0]["organisasjonsnummer"] for call in update_service.company_repo.create_or_update.call_args_list
    ]
    assert called_orgnrs == ["111111111", "555555555", "999999999"]


class TestFetchSubunitUpdates:
    """Tests for subunit update fetching with self-healing parent companies."""

    @pytest.mark.asyncio
    async def test_fetch_subunit_updates_handles_missing_parents(self, update_service, mock_db):
        # 1. Mock page response
        mock_page_response = MagicMock(status_code=200)
        mock_page_response.json.return_value = {
            "_embedded": {"oppdaterteUnderenheter": [{"organisasjonsnummer": "123", "oppdateringsid": 1}]},
            "_links": {},
        }

        # 2. Mock subunit and parent data
        update_service.brreg_api.fetch_subunit = AsyncMock(
            return_value={"organisasjonsnummer": "123", "overordnetEnhet": "456"}
        )
        update_service.brreg_api.fetch_company = AsyncMock(
            return_value={"organisasjonsnummer": "456", "navn": "Parent"}
        )

        # 3. Mock repos
        update_service.company_repo.get_existing_orgnrs = AsyncMock(side_effect=[set(), {"456"}])
        update_service.company_repo.create_or_update = AsyncMock()
        update_service.subunit_repo.create_batch = AsyncMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get.return_value = mock_page_response
            await update_service.fetch_subunit_updates(page_size=10)

            update_service.brreg_api.fetch_company.assert_called_once_with("456")
            update_service.company_repo.create_or_update.assert_called_once()
            update_service.subunit_repo.create_batch.assert_called_once()

    @pytest.mark.asyncio
    async def test_fetch_subunit_updates_purges_deleted(self, update_service, mock_db):
        """Verify that subunits marked as deleted in Brreg are purged from DB."""
        # 1. Mock page response
        mock_page_response = MagicMock(status_code=200)
        mock_page_response.json.return_value = {
            "_embedded": {"oppdaterteUnderenheter": [{"organisasjonsnummer": "999", "oppdateringsid": 1}]},
            "_links": {},
        }

        # 2. Mock deleted subunit response (no parent, has respons_klasse)
        update_service.brreg_api.fetch_subunit = AsyncMock(
            return_value={
                "organisasjonsnummer": "999",
                "navn": "Deleted Co",
                "respons_klasse": "SlettetUnderEnhet",
            }
        )

        # 3. Mock repo
        update_service.subunit_repo.delete_by_orgnr = AsyncMock(return_value=1)
        update_service.subunit_repo.create_batch = AsyncMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get.return_value = mock_page_response

            result_dict = await update_service.fetch_subunit_updates(page_size=10)

            update_service.subunit_repo.delete_by_orgnr.assert_called_once_with("999")
            update_service.subunit_repo.create_batch.assert_not_called()
            assert result_dict["companies_deleted"] == 1


@pytest.mark.asyncio
async def test_ensure_parent_companies_exist_sorts_missing_orgnrs(update_service, mock_db):
    update_service.company_repo.get_existing_orgnrs = AsyncMock(side_effect=[set(), {"111", "222", "333"}])
    update_service.brreg_api.fetch_company = AsyncMock(
        side_effect=[
            {"organisasjonsnummer": "111", "navn": "First"},
            {"organisasjonsnummer": "222", "navn": "Second"},
            {"organisasjonsnummer": "333", "navn": "Third"},
        ]
    )
    update_service.company_repo.create_or_update = AsyncMock()
    update_service.report_sync_error = AsyncMock()

    subunits_data = [
        {"overordnetEnhet": "333"},
        {"overordnetEnhet": "111"},
        {"overordnetEnhet": "222"},
    ]

    await update_service._ensure_parent_companies_exist(subunits_data)

    called_orgnrs = [call.args[0] for call in update_service.brreg_api.fetch_company.call_args_list]
    assert called_orgnrs == ["111", "222", "333"]


@pytest.mark.asyncio
async def test_ensure_parent_companies_exist_skips_deleted(update_service, mock_db):
    """Verify that deleted parent companies (with slettedato) are not onboarded."""
    # 1. Arrange: missing parent '999' which is deleted
    update_service.company_repo.get_existing_orgnrs = AsyncMock(return_value=set())
    update_service.brreg_api.fetch_company = AsyncMock(
        return_value={"organisasjonsnummer": "999", "slettedato": "2023-01-01"}
    )
    update_service.company_repo.create_or_update = AsyncMock()

    # 2. Act
    subunits_data = [{"overordnetEnhet": "999"}]
    verified = await update_service._ensure_parent_companies_exist(subunits_data)

    # 3. Assert
    update_service.company_repo.create_or_update.assert_not_called()
    assert "999" not in verified


@pytest.mark.asyncio
class TestFetchRoleUpdates:
    """Tests for role updates fetching and processing."""

    async def test_fetch_role_updates_verifies_parents(self, update_service, mock_db):
        # 1. Mock pagination: Page 1 has 1 item, Page 2 is empty
        mock_resp_1 = MagicMock(status_code=200)
        mock_resp_1.json.return_value = [{"id": "100", "data": {"organisasjonsnummer": "123"}}]
        mock_resp_2 = MagicMock(status_code=200)
        mock_resp_2.json.return_value = []

        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = mock_client.return_value.__aenter__.return_value
            mock_instance.get.side_effect = [mock_resp_1, mock_resp_2]

            # 2. Mock role and parent logic
            update_service.brreg_api.fetch_roles = AsyncMock(return_value=[{"enhet_orgnr": "ROLE_PARENT"}])
            update_service._ensure_parent_companies_exist = AsyncMock(return_value={"ROLE_PARENT"})
            update_service.company_repo.get_existing_orgnrs = AsyncMock(return_value={"123"})
            update_service.role_repo.create_batch = AsyncMock()

            # 3. Act
            await update_service.fetch_role_updates(page_size=10)

            # 4. Assert
            update_service._ensure_parent_companies_exist.assert_called_once()
            update_service.role_repo.create_batch.assert_called_once()
            assert mock_db.commit.call_count >= 2

    async def test_fetch_role_updates_skips_deleted_companies(self, update_service, mock_db):
        """Verify that deleted companies (with slettedato) are not onboarded."""
        # 1. Mock pagination
        mock_resp_1 = MagicMock(status_code=200)
        mock_resp_1.json.return_value = [{"id": "100", "data": {"organisasjonsnummer": "999"}}]
        mock_resp_2 = MagicMock(status_code=200)
        mock_resp_2.json.return_value = []

        with patch("httpx.AsyncClient") as mock_client:
            mock_instance = mock_client.return_value.__aenter__.return_value
            mock_instance.get.side_effect = [mock_resp_1, mock_resp_2]

            # 2. Mock unknown company that is deleted in Brreg
            update_service.company_repo.get_existing_orgnrs = AsyncMock(return_value=set())
            update_service.subunit_repo.get_existing_orgnrs = AsyncMock(return_value=set())
            update_service.brreg_api.fetch_company = AsyncMock(
                return_value={"organisasjonsnummer": "999", "slettedato": "2023-01-01"}
            )

            # 3. Act
            await update_service.fetch_role_updates(page_size=10)

            # 4. Assert
            # create_or_update should NOT be called for deleted company
            update_service.company_repo.create_or_update.assert_not_called()
            # Role sync should be skipped for this company
            update_service.brreg_api.fetch_roles.assert_not_called()

    async def test_report_sync_error_smart_filtering(self, update_service, mock_db):
        mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=lambda: None))

        # 404 for accounting should be ignored
        await update_service.report_sync_error("123", "accounting", "Msg", status_code=404)
        assert mock_db.add.call_count == 0

        # 404 for role should be ignored
        await update_service.report_sync_error("123", "role", "Msg", status_code=404)
        assert mock_db.add.call_count == 0

        # 404 for company should be recorded
        await update_service.report_sync_error("123", "company", "Msg", status_code=404)
        assert mock_db.add.call_count == 1


class TestFetchChunkDetails:
    """Tests for concurrent API fetching in chunks."""

    @pytest.mark.asyncio
    async def test_fetch_chunk_details_fetches_concurrently(self, update_service):
        """_fetch_chunk_details should fetch company data for each update."""
        entities = [
            {"organisasjonsnummer": "111111111", "oppdateringsid": 1},
            {"organisasjonsnummer": "222222222", "oppdateringsid": 2},
        ]

        update_service.brreg_api.fetch_company = AsyncMock(
            side_effect=[
                {"organisasjonsnummer": "111111111", "navn": "Company 1"},
                {"organisasjonsnummer": "222222222", "navn": "Company 2"},
            ]
        )

        result = await update_service._fetch_chunk_details(entities)

        assert len(result) == 2
        assert result[0].orgnr == "111111111"
        assert result[1].orgnr == "222222222"
        assert update_service.brreg_api.fetch_company.call_count == 2

    @pytest.mark.asyncio
    async def test_fetch_chunk_details_handles_api_errors(self, update_service):
        """_fetch_chunk_details should mark failures for API errors."""
        entities = [{"organisasjonsnummer": "123456789", "oppdateringsid": 1}]

        update_service.brreg_api.fetch_company = AsyncMock(side_effect=Exception("API timeout"))

        result = await update_service._fetch_chunk_details(entities)

        assert len(result) == 1
        assert result[0].success is False
        assert "API timeout" in result[0].error

    @pytest.mark.asyncio
    async def test_fetch_chunk_details_marks_deletion(self, update_service):
        """_fetch_chunk_details should mark Sletting as success=True with company_data=None."""
        entities = [
            {
                "organisasjonsnummer": "123456789",
                "oppdateringsid": 1,
                "endringstype": "Sletting",
            }
        ]

        update_service.brreg_api.fetch_company = AsyncMock()

        result = await update_service._fetch_chunk_details(entities)

        assert len(result) == 1
        assert result[0].success is True
        assert result[0].company_data is None
        # Should NOT call the API for deletions
        update_service.brreg_api.fetch_company.assert_not_called()


class TestPersistChunk:
    """Tests for sequential database persistence."""

    @pytest.mark.asyncio
    async def test_persist_chunk_creates_company(self, update_service):
        """_persist_chunk should create company from successful fetch."""
        company = MagicMock()
        company.last_polled_regnskap = date.today()
        update_service.company_repo.create_or_update = AsyncMock(return_value=company)
        update_service._fetch_and_persist_financials = AsyncMock()

        fetch_results = [
            FetchResult(
                orgnr="123456789", success=True, company_data={"organisasjonsnummer": "123456789", "navn": "Test"}
            )
        ]
        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-01-26T00:00:00.000Z")

        await update_service._persist_chunk(fetch_results, result)

        update_service.company_repo.create_or_update.assert_called_once()
        assert result.companies_processed == 1

    @pytest.mark.asyncio
    async def test_persist_chunk_skips_failed_fetches(self, update_service):
        """_persist_chunk should skip items that failed to fetch."""
        update_service.company_repo.create_or_update = AsyncMock()
        update_service.report_sync_error = AsyncMock()  # Mock to avoid unawaited warning

        fetch_results = [FetchResult(orgnr="123456789", success=False, error="API error")]
        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-01-26T00:00:00.000Z")

        await update_service._persist_chunk(fetch_results, result)

        update_service.company_repo.create_or_update.assert_not_called()
        assert result.api_errors == 1

    @pytest.mark.asyncio
    async def test_persist_chunk_deletes_company_on_none_data(self, update_service):
        """_persist_chunk should delete company when success=True but company_data=None (Sletting)."""
        update_service.company_repo.delete_by_orgnr = AsyncMock(return_value=1)

        fetch_results = [FetchResult(orgnr="123456789", success=True, company_data=None)]
        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-01-26T00:00:00.000Z")

        await update_service._persist_chunk(fetch_results, result)

        update_service.company_repo.delete_by_orgnr.assert_called_once_with("123456789")
        assert result.companies_deleted == 1
        assert result.companies_processed == 1

    @pytest.mark.asyncio
    async def test_persist_chunk_records_employee_count_change(self, update_service):
        company = MagicMock()
        company.last_polled_regnskap = date.today()
        update_service.company_repo.create_or_update = AsyncMock(return_value=company)
        update_service._record_company_event_safe = AsyncMock()
        update_service._get_existing_employee_counts = AsyncMock(return_value={"123456789": 10})

        fetch_results = [
            FetchResult(
                orgnr="123456789",
                success=True,
                company_data={"organisasjonsnummer": "123456789", "navn": "Test", "antallAnsatte": 14},
                source_update_id="update-1",
                source_event_time=None,
                source_change_type="Endring",
            )
        ]
        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-01-26T00:00:00.000Z")

        await update_service._persist_chunk(fetch_results, result)

        update_service._record_company_event_safe.assert_awaited_once_with(
            orgnr="123456789",
            event_type="employee_count_changed",
            source="Enhetsregisteret via Brreg",
            source_update_id="update-1",
            occurred_at=None,
            previous_value={"antall_ansatte": 10},
            new_value={"antall_ansatte": 14},
            payload={"time_semantics": "Tidspunkt fra Brregs oppdateringsstrøm når tilgjengelig."},
        )


class TestFetchAndPersistFinancials:
    """Tests for financial data fetching."""

    @pytest.mark.asyncio
    async def test_fetch_financials_calls_api(self, update_service, mock_db):
        """Should fetch financials via API for given orgnr."""
        update_service.brreg_api.fetch_financial_statements = AsyncMock(return_value=[])
        update_service.company_repo.update_last_polled_regnskap = AsyncMock()

        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-01-26T00:00:00.000Z")

        await update_service._fetch_and_persist_financials("123456789", result)

        update_service.brreg_api.fetch_financial_statements.assert_called_once_with("123456789")
        update_service.company_repo.update_last_polled_regnskap.assert_called_once_with("123456789")

    @pytest.mark.asyncio
    async def test_fetch_financials_parses_and_stores(self, update_service, mock_db):
        """Should parse and store financial statements."""
        update_service.brreg_api.fetch_financial_statements = AsyncMock(
            return_value=[{"id": 1, "regnskapsperiode": {"fraDato": "2024-01-01", "tilDato": "2024-12-31"}}]
        )
        update_service.brreg_api.parse_financial_data = AsyncMock(return_value={"aar": 2024, "orgnr": "123456789"})
        update_service.accounting_repo.create_or_update = AsyncMock()
        update_service.company_repo.update_last_polled_regnskap = AsyncMock()

        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-01-26T00:00:00.000Z")

        await update_service._fetch_and_persist_financials("123456789", result)

        update_service.accounting_repo.create_or_update.assert_called_once()
        assert result.financials_updated == 1

    @pytest.mark.asyncio
    async def test_fetch_financials_handles_api_error(self, update_service, mock_db):
        """Should handle API errors gracefully."""
        update_service.brreg_api.fetch_financial_statements = AsyncMock(side_effect=Exception("API error"))

        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-01-26T00:00:00.000Z")

        await update_service._fetch_and_persist_financials("123456789", result)

        # Should record error but not raise
        assert len(result.errors) == 1
        assert "API error" in result.errors[0]


class TestFetchSubunitUpdatesEdgeCases:
    """Additional edge case tests for subunit updates."""

    @pytest.mark.asyncio
    async def test_handles_empty_page_response(self, update_service, mock_db):
        """Should handle empty response gracefully."""
        mock_resp = MagicMock(status_code=200)
        mock_resp.json.return_value = {"_embedded": {"oppdaterteUnderenheter": []}, "_links": {}}

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get.return_value = mock_resp

            result = await update_service.fetch_subunit_updates(page_size=10)

            # Result should have proper structure
            assert isinstance(result, dict)
            assert "errors" in result or "since_date" in result

    @pytest.mark.asyncio
    async def test_handles_api_error_response(self, update_service, mock_db):
        """Should handle non-200 API response."""
        mock_resp = MagicMock(status_code=500)

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get.return_value = mock_resp

            result = await update_service.fetch_subunit_updates(page_size=10)

            # Should return result dict with errors
            assert isinstance(result, dict)
