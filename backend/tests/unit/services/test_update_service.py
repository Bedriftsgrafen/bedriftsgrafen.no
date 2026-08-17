"""
Unit tests for UpdateService.

Tests incremental update fetching and processing phases.
Follows AAA pattern (Arrange - Act - Assert).
"""

from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from schemas.brreg import BrregUpdateEntity, FetchResult, SubunitFetchResult, UpdateBatchResult
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
    service._get_existing_company_event_snapshots = AsyncMock(return_value={})
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

        result = await update_service.fetch_updates(page_size=1)

        assert update_service._process_single_page.call_count == 2
        assert result["companies_processed"] == 0

    @pytest.mark.asyncio
    async def test_fetch_updates_stops_before_next_page_after_cursor_gap(self, update_service):
        first_page = MagicMock(status_code=200)
        first_page.json.return_value = {
            "_embedded": {"oppdaterteEnheter": [{"organisasjonsnummer": "123456789"}]},
            "_links": {"next": {"href": "https://stub.invalid/page/2"}},
        }
        second_page = MagicMock(status_code=200)
        second_page.json.return_value = {"_embedded": {"oppdaterteEnheter": []}, "_links": {}}
        update_service.brreg_api._get = AsyncMock(side_effect=[first_page, second_page])
        update_service._fetch_chunk_details = AsyncMock(
            return_value=[
                FetchResult(
                    orgnr="123456789",
                    success=False,
                    error="API timeout",
                    source_update_id="42",
                )
            ]
        )
        update_service.report_sync_error = AsyncMock()

        result = await update_service.fetch_updates(start_id=41, page_size=1)

        assert update_service.brreg_api._get.await_count == 1
        assert result["latest_oppdateringsid"] is None

    @pytest.mark.asyncio
    async def test_fetch_updates_requests_included_changes(self, update_service):
        update_service._process_single_page = AsyncMock(return_value=None)

        await update_service.fetch_updates(start_id=123, page_size=10)

        first_url = update_service._process_single_page.await_args.kwargs["url"]
        assert "oppdateringsid=123" in first_url
        assert "includeChanges=true" in first_url


class TestBrregUpdateSchemas:
    def test_update_entity_accepts_fjernet_and_changes(self):
        entity = BrregUpdateEntity.model_validate(
            {
                "organisasjonsnummer": "123456789",
                "oppdateringsid": 42,
                "endringstype": "Fjernet",
                "dato": "2026-05-27T12:00:00Z",
                "endringer": [{"op": "replace", "path": "/navn", "value": "Nytt Navn AS"}],
            }
        )

        assert entity.endringstype == "Fjernet"
        assert entity.endringer[0].path == "/navn"


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
    async def test_fetch_subunit_updates_requests_included_changes(self, update_service):
        mock_page_response = MagicMock(status_code=200)
        mock_page_response.json.return_value = {"_embedded": {"oppdaterteUnderenheter": []}, "_links": {}}

        update_service.brreg_api._get = AsyncMock(return_value=mock_page_response)

        await update_service.fetch_subunit_updates(start_id=123, page_size=10)

        first_url = update_service.brreg_api._get.await_args.args[0]
        assert "oppdateringsid=123" in first_url
        assert "includeChanges=true" in first_url

    @pytest.mark.asyncio
    async def test_fetch_subunit_updates_stops_before_next_page_after_cursor_gap(self, update_service):
        first_page = MagicMock(status_code=200)
        first_page.json.return_value = {
            "_embedded": {"oppdaterteUnderenheter": [{"organisasjonsnummer": "123456789"}]},
            "_links": {"next": {"href": "https://stub.invalid/page/2"}},
        }
        second_page = MagicMock(status_code=200)
        second_page.json.return_value = {"_embedded": {"oppdaterteUnderenheter": []}, "_links": {}}
        update_service.brreg_api._get = AsyncMock(side_effect=[first_page, second_page])
        update_service._fetch_subunit_update_details = AsyncMock(
            return_value=[
                SubunitFetchResult(
                    orgnr="123456789",
                    success=False,
                    error="API timeout",
                    source_update_id="42",
                )
            ]
        )

        result = await update_service.fetch_subunit_updates(start_id=41, page_size=1)

        assert update_service.brreg_api._get.await_count == 1
        assert result["latest_oppdateringsid"] is None

    @pytest.mark.asyncio
    async def test_fetch_subunit_update_details_marks_deletion_without_fetch(self, update_service):
        entities = [
            {
                "organisasjonsnummer": "123456789",
                "oppdateringsid": 10,
                "endringstype": "Sletting",
                "dato": "2026-05-27T12:00:00Z",
            }
        ]

        update_service.brreg_api.fetch_subunit = AsyncMock()

        results = await update_service._fetch_subunit_update_details(entities)

        assert results[0].success is True
        assert results[0].subunit_data is None
        assert results[0].source_change_type == "Sletting"
        update_service.brreg_api.fetch_subunit.assert_not_called()

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

        update_service.brreg_api._get = AsyncMock(return_value=mock_page_response)

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

        update_service.brreg_api._get = AsyncMock(return_value=mock_page_response)

        result_dict = await update_service.fetch_subunit_updates(page_size=10)

        update_service.subunit_repo.delete_by_orgnr.assert_called_once_with("999")
        update_service.subunit_repo.create_batch.assert_not_called()
        assert result_dict["companies_deleted"] == 1

    @pytest.mark.asyncio
    async def test_persist_subunit_page_records_opened_event(self, update_service):
        update_service.event_ledger_enabled = True
        update_service._get_existing_subunit_event_snapshots = AsyncMock(return_value={})
        update_service._ensure_parent_companies_exist = AsyncMock(return_value={"987654321"})
        update_service.subunit_repo.create_batch = AsyncMock(return_value=1)
        update_service._record_company_event_safe = AsyncMock()

        fetch_results = [
            SubunitFetchResult(
                orgnr="123456789",
                success=True,
                subunit_data={
                    "organisasjonsnummer": "123456789",
                    "overordnetEnhet": "987654321",
                    "navn": "Ny Avdeling",
                    "organisasjonsform": {"kode": "BEDR"},
                    "naeringskode1": {"kode": "47.111", "beskrivelse": "Butikkhandel"},
                    "antallAnsatte": 5,
                    "registreringsdatoEnhetsregisteret": "2026-05-26",
                },
                source_update_id="subunit-1",
                source_change_type="Ny",
            )
        ]
        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-05-27T00:00:00.000Z")

        await update_service._persist_subunit_update_page(fetch_results, result)

        update_service._record_company_event_safe.assert_awaited_once()
        event_kwargs = update_service._record_company_event_safe.await_args.kwargs
        assert event_kwargs["orgnr"] == "123456789"
        assert event_kwargs["event_type"] == "subunit_opened"
        assert event_kwargs["source_update_id"] == "subunit-1"
        assert event_kwargs["payload"]["parent_orgnr"] == "987654321"
        assert event_kwargs["payload"]["entity_type"] == "subunit"
        assert result.companies_updated == 1

    @pytest.mark.asyncio
    async def test_persist_subunit_page_records_grouped_change_events(self, update_service):
        update_service.event_ledger_enabled = True
        update_service._get_existing_subunit_event_snapshots = AsyncMock(
            return_value={
                "123456789": {
                    "orgnr": "123456789",
                    "parent_orgnr": "987654321",
                    "navn": "Avdeling",
                    "organisasjonsform": "BEDR",
                    "naeringskode": "47.111",
                    "antall_ansatte": 5,
                    "beliggenhetsadresse": {"postnummer": "0101", "poststed": "OSLO"},
                    "postadresse": None,
                    "raw_data": {
                        "naeringskode1": {"kode": "47.111", "beskrivelse": "Butikkhandel"},
                        "aktivitet": "Gammel aktivitet",
                    },
                }
            }
        )
        update_service._ensure_parent_companies_exist = AsyncMock(return_value={"987654321"})
        update_service.subunit_repo.create_batch = AsyncMock(return_value=1)
        update_service._record_company_event_safe = AsyncMock()

        fetch_results = [
            SubunitFetchResult(
                orgnr="123456789",
                success=True,
                subunit_data={
                    "organisasjonsnummer": "123456789",
                    "overordnetEnhet": "987654321",
                    "navn": "Avdeling",
                    "organisasjonsform": {"kode": "BEDR"},
                    "naeringskode1": {"kode": "62.010", "beskrivelse": "Programmeringstjenester"},
                    "aktivitet": "Ny aktivitet",
                    "antallAnsatte": 8,
                    "beliggenhetsadresse": {"postnummer": "5003", "poststed": "BERGEN"},
                },
                source_update_id="subunit-2",
                source_change_type="Endring",
                source_changes=[
                    {"path": "/beliggenhetsadresse/postnummer", "op": "replace"},
                    {"path": "/naeringskode1/kode", "op": "replace"},
                    {"path": "/antallAnsatte", "op": "replace"},
                    {"path": "/ukjentFelt", "op": "replace"},
                ],
            )
        ]
        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-05-27T00:00:00.000Z")

        await update_service._persist_subunit_update_page(fetch_results, result)

        event_types = [call.kwargs["event_type"] for call in update_service._record_company_event_safe.await_args_list]
        assert event_types == [
            "subunit_address_changed",
            "subunit_industry_changed",
            "subunit_employee_count_changed",
        ]
        first_payload = update_service._record_company_event_safe.await_args_list[0].kwargs["payload"]
        assert first_payload["parent_orgnr"] == "987654321"
        assert first_payload["brreg_change_paths"] == ["/beliggenhetsadresse/postnummer"]
        assert first_payload["brreg_change_count"] == 4
        assert result.companies_updated == 1

    @pytest.mark.asyncio
    async def test_persist_subunit_page_records_closed_event(self, update_service):
        update_service.event_ledger_enabled = True
        update_service._get_existing_subunit_event_snapshots = AsyncMock(
            return_value={
                "123456789": {
                    "orgnr": "123456789",
                    "parent_orgnr": "987654321",
                    "navn": "Avdeling",
                    "organisasjonsform": "BEDR",
                    "naeringskode": "47.111",
                    "antall_ansatte": 5,
                }
            }
        )
        update_service.subunit_repo.delete_by_orgnr = AsyncMock(return_value=1)
        update_service._record_company_event_safe = AsyncMock()

        fetch_results = [
            SubunitFetchResult(
                orgnr="123456789",
                success=True,
                subunit_data=None,
                source_update_id="subunit-3",
                source_event_time=None,
                source_change_type="Fjernet",
            )
        ]
        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-05-27T00:00:00.000Z")

        await update_service._persist_subunit_update_page(fetch_results, result)

        update_service.subunit_repo.delete_by_orgnr.assert_awaited_once_with("123456789")
        update_service._record_company_event_safe.assert_awaited_once()
        event_kwargs = update_service._record_company_event_safe.await_args.kwargs
        assert event_kwargs["event_type"] == "subunit_closed"
        assert event_kwargs["payload"]["parent_orgnr"] == "987654321"
        assert result.companies_deleted == 1

    @pytest.mark.asyncio
    async def test_persist_subunit_page_blocks_cursor_when_delete_fails(self, update_service):
        update_service.event_ledger_enabled = False
        update_service.subunit_repo.delete_by_orgnr = AsyncMock(side_effect=Exception("DB down"))
        fetch_results = [
            SubunitFetchResult(
                orgnr="123456789",
                success=True,
                subunit_data=None,
                source_update_id="42",
                source_change_type="Fjernet",
            )
        ]
        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-05-27T00:00:00.000Z")

        cursor_gap_detected = await update_service._persist_subunit_update_page(fetch_results, result)

        assert cursor_gap_detected is True
        assert result.latest_oppdateringsid is None
        assert result.db_errors == 1

    @pytest.mark.asyncio
    async def test_persist_subunit_page_advances_cursor_after_successful_upsert(self, update_service):
        update_service.event_ledger_enabled = False
        update_service._ensure_parent_companies_exist = AsyncMock(return_value={"987654321"})
        update_service.subunit_repo.create_batch = AsyncMock(return_value=1)

        fetch_results = [
            SubunitFetchResult(
                orgnr="123456789",
                success=True,
                subunit_data={
                    "organisasjonsnummer": "123456789",
                    "overordnetEnhet": "987654321",
                    "navn": "Avdeling",
                },
                source_update_id="42",
            )
        ]
        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-05-27T00:00:00.000Z")

        await update_service._persist_subunit_update_page(fetch_results, result)

        assert result.latest_oppdateringsid == 42

    @pytest.mark.asyncio
    async def test_persist_subunit_page_does_not_advance_past_earlier_failed_update(self, update_service):
        update_service.event_ledger_enabled = False
        update_service._ensure_parent_companies_exist = AsyncMock(return_value={"987654321"})
        update_service.subunit_repo.create_batch = AsyncMock(return_value=1)

        fetch_results = [
            SubunitFetchResult(orgnr="111111111", success=False, error="API timeout", source_update_id="2"),
            SubunitFetchResult(
                orgnr="222222222",
                success=True,
                subunit_data={
                    "organisasjonsnummer": "222222222",
                    "navn": "Avdeling",
                    "overordnetEnhet": "987654321",
                },
                source_update_id="99",
            ),
        ]
        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-05-27T00:00:00.000Z")

        await update_service._persist_subunit_update_page(fetch_results, result)

        assert result.latest_oppdateringsid is None


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
async def test_ensure_parent_companies_exist_propagates_fetch_failure(update_service):
    update_service.company_repo.get_existing_orgnrs = AsyncMock(return_value=set())
    update_service.brreg_api.fetch_company = AsyncMock(side_effect=Exception("egress capacity exhausted"))

    with pytest.raises(Exception, match="egress capacity exhausted"):
        await update_service._ensure_parent_companies_exist([{"overordnetEnhet": "999"}])


@pytest.mark.asyncio
class TestFetchRoleUpdates:
    """Tests for role updates fetching and processing."""

    async def test_fetch_role_updates_verifies_parents(self, update_service, mock_db):
        # 1. Mock pagination: Page 1 has 1 item, Page 2 is empty
        mock_resp_1 = MagicMock(status_code=200)
        mock_resp_1.json.return_value = [{"id": "100", "data": {"organisasjonsnummer": "123"}}]
        mock_resp_2 = MagicMock(status_code=200)
        mock_resp_2.json.return_value = []

        update_service.brreg_api._get = AsyncMock(side_effect=[mock_resp_1, mock_resp_2])

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

        update_service.brreg_api._get = AsyncMock(side_effect=[mock_resp_1, mock_resp_2])

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

    async def test_fetch_role_updates_records_coarse_roles_changed_event(self, update_service, mock_db):
        mock_resp = MagicMock(status_code=200)
        mock_resp.json.return_value = [
            {
                "id": "500",
                "type": "no.brreg.enhetsregisteret.roller.oppdatert",
                "source": "/enhetsregisteret/oppdateringer/roller",
                "subject": "987654321",
                "time": "2026-05-27T12:30:00Z",
                "data": {"organisasjonsnummer": "987654321"},
            }
        ]

        update_service.company_repo.get_existing_orgnrs = AsyncMock(return_value={"987654321"})
        update_service.subunit_repo.get_existing_orgnrs = AsyncMock(return_value=set())
        update_service.brreg_api.fetch_roles = AsyncMock(
            return_value=[
                {"type_kode": "DAGL", "person_navn": "Ola Nordmann", "foedselsdato": "1980-01-01"},
                {"type_kode": "LEDE", "person_navn": "Kari Nordmann", "foedselsdato": "1981-01-01"},
            ]
        )
        update_service.role_repo.create_batch = AsyncMock()
        update_service._record_company_event_safe = AsyncMock()

        update_service.brreg_api._get = AsyncMock(return_value=mock_resp)

        result = await update_service.fetch_role_updates(since_date=date(2026, 5, 27), page_size=10)

        update_service._record_company_event_safe.assert_awaited_once()
        event_kwargs = update_service._record_company_event_safe.await_args.kwargs
        assert event_kwargs["orgnr"] == "987654321"
        assert event_kwargs["event_type"] == "roles_changed"
        assert event_kwargs["source"] == "Enhetsregisteret roller via Brreg"
        assert event_kwargs["source_update_id"] == "500"
        assert event_kwargs["new_value"] == {"role_count": 2}
        assert event_kwargs["payload"] == {
            "entity_type": "role_update",
            "time_semantics": "Tidspunkt fra Brregs rolleoppdateringsstrøm når tilgjengelig.",
            "cloud_event_type": "no.brreg.enhetsregisteret.roller.oppdatert",
            "cloud_event_source": "/enhetsregisteret/oppdateringer/roller",
            "cloud_event_subject": "987654321",
        }
        assert "Ola Nordmann" not in str(event_kwargs["payload"])
        assert result["companies_updated"] == 1

    async def test_fetch_role_updates_uses_latest_role_event_per_orgnr(self, update_service, mock_db):
        mock_resp = MagicMock(status_code=200)
        mock_resp.json.return_value = [
            {
                "id": "500",
                "time": "2026-05-27T12:00:00Z",
                "data": {"organisasjonsnummer": "987654321"},
            },
            {
                "id": "505",
                "time": "2026-05-27T13:00:00Z",
                "data": {"organisasjonsnummer": "987654321"},
            },
        ]

        update_service.company_repo.get_existing_orgnrs = AsyncMock(return_value={"987654321"})
        update_service.subunit_repo.get_existing_orgnrs = AsyncMock(return_value=set())
        update_service.brreg_api.fetch_roles = AsyncMock(return_value=[])
        update_service._record_company_event_safe = AsyncMock()

        update_service.brreg_api._get = AsyncMock(return_value=mock_resp)

        result = await update_service.fetch_role_updates(since_date=date(2026, 5, 27), page_size=10)

        update_service._record_company_event_safe.assert_awaited_once()
        assert update_service._record_company_event_safe.await_args.kwargs["source_update_id"] == "505"
        assert result["latest_oppdateringsid"] == 505

    async def test_fetch_role_updates_does_not_advance_cursor_on_role_fetch_failure(self, update_service, mock_db):
        mock_resp = MagicMock(status_code=200)
        mock_resp.json.return_value = [
            {
                "id": "500",
                "time": "2026-05-27T12:00:00Z",
                "data": {"organisasjonsnummer": "987654321"},
            }
        ]

        update_service.company_repo.get_existing_orgnrs = AsyncMock(return_value={"987654321"})
        update_service.subunit_repo.get_existing_orgnrs = AsyncMock(return_value=set())
        update_service.brreg_api.fetch_roles = AsyncMock(side_effect=Exception("role API down"))
        update_service.report_sync_error = AsyncMock()

        update_service.brreg_api._get = AsyncMock(return_value=mock_resp)

        result = await update_service.fetch_role_updates(since_date=date(2026, 5, 27), page_size=10)

        assert result["latest_oppdateringsid"] is None
        update_service.system_repo.set_state.assert_not_called()
        update_service.report_sync_error.assert_awaited_once()

    async def test_fetch_role_updates_does_not_advance_cursor_on_onboarding_failure(self, update_service):
        mock_resp = MagicMock(status_code=200)
        mock_resp.json.return_value = [
            {
                "id": "500",
                "time": "2026-05-27T12:00:00Z",
                "data": {"organisasjonsnummer": "987654321"},
            }
        ]

        update_service.company_repo.get_existing_orgnrs = AsyncMock(return_value=set())
        update_service.subunit_repo.get_existing_orgnrs = AsyncMock(return_value=set())
        update_service.brreg_api.fetch_company = AsyncMock(side_effect=Exception("egress capacity exhausted"))
        update_service.report_sync_error = AsyncMock()
        update_service.brreg_api._get = AsyncMock(return_value=mock_resp)

        result = await update_service.fetch_role_updates(since_date=date(2026, 5, 27), page_size=10)

        assert result["latest_oppdateringsid"] is None
        update_service.brreg_api.fetch_roles.assert_not_called()
        update_service.system_repo.set_state.assert_not_called()
        update_service.report_sync_error.assert_awaited_once()

    async def test_fetch_role_updates_does_not_advance_cursor_on_onboarding_persist_failure(self, update_service):
        mock_resp = MagicMock(status_code=200)
        mock_resp.json.return_value = [
            {
                "id": "500",
                "time": "2026-05-27T12:00:00Z",
                "data": {"organisasjonsnummer": "987654321"},
            }
        ]

        update_service.company_repo.get_existing_orgnrs = AsyncMock(return_value=set())
        update_service.subunit_repo.get_existing_orgnrs = AsyncMock(return_value=set())
        update_service.brreg_api.fetch_company = AsyncMock(
            return_value={"organisasjonsnummer": "987654321", "navn": "Test AS"}
        )
        update_service.company_repo.create_or_update = AsyncMock(side_effect=Exception("DB down"))
        update_service.report_sync_error = AsyncMock()
        update_service.brreg_api._get = AsyncMock(return_value=mock_resp)

        result = await update_service.fetch_role_updates(since_date=date(2026, 5, 27), page_size=10)

        assert result["latest_oppdateringsid"] is None
        update_service.brreg_api.fetch_roles.assert_not_called()
        update_service.system_repo.set_state.assert_not_called()
        update_service.report_sync_error.assert_awaited_once()

    async def test_fetch_role_updates_advances_cursor_to_success_before_failure(self, update_service, mock_db):
        mock_resp = MagicMock(status_code=200)
        mock_resp.json.return_value = [
            {
                "id": "500",
                "time": "2026-05-27T12:00:00Z",
                "data": {"organisasjonsnummer": "111111111"},
            },
            {
                "id": "505",
                "time": "2026-05-27T13:00:00Z",
                "data": {"organisasjonsnummer": "222222222"},
            },
        ]

        update_service.company_repo.get_existing_orgnrs = AsyncMock(return_value={"111111111", "222222222"})
        update_service.subunit_repo.get_existing_orgnrs = AsyncMock(return_value=set())
        update_service.brreg_api.fetch_roles = AsyncMock(side_effect=[[], Exception("role API down")])
        update_service.report_sync_error = AsyncMock()
        update_service._record_company_event_safe = AsyncMock()

        update_service.brreg_api._get = AsyncMock(return_value=mock_resp)

        result = await update_service.fetch_role_updates(since_date=date(2026, 5, 27), page_size=10)

        assert result["latest_oppdateringsid"] == 500
        update_service.system_repo.set_state.assert_awaited_once_with("role_update_latest_id", "500")
        update_service.report_sync_error.assert_awaited_once()

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
            {"organisasjonsnummer": "111111111", "oppdateringsid": 1, "endringer": [{"path": "/navn"}]},
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
        assert result[0].source_changes[0].path == "/navn"
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

    @pytest.mark.asyncio
    async def test_fetch_chunk_details_marks_fjernet_without_fetch(self, update_service):
        entities = [
            {
                "organisasjonsnummer": "123456789",
                "oppdateringsid": 1,
                "endringstype": "Fjernet",
            }
        ]

        update_service.brreg_api.fetch_company = AsyncMock()

        result = await update_service._fetch_chunk_details(entities)

        assert result[0].success is True
        assert result[0].company_data is None
        assert result[0].source_change_type == "Fjernet"
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
    async def test_persist_chunk_records_new_source_event_for_existing_company(self, update_service):
        company = MagicMock()
        company.last_polled_regnskap = date.today()
        update_service.company_repo.create_or_update = AsyncMock(return_value=company)
        update_service._record_company_event_safe = AsyncMock()
        update_service._record_company_update_events_from_changes = AsyncMock()

        fetch_results = [
            FetchResult(
                orgnr="123456789",
                success=True,
                company_data={
                    "organisasjonsnummer": "123456789",
                    "navn": "Test AS",
                    "registreringsdatoEnhetsregisteret": "2026-05-28",
                    "organisasjonsform": {"kode": "AS"},
                    "antallAnsatte": 5,
                },
                source_update_id="24497872",
                source_change_type="Ny",
            )
        ]
        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-01-26T00:00:00.000Z")

        await update_service._persist_chunk(fetch_results, result)

        update_service._record_company_event_safe.assert_awaited_once()
        assert update_service._record_company_event_safe.await_args.kwargs["event_type"] == "company_registered"
        assert update_service._record_company_event_safe.await_args.kwargs["source_update_id"] == "24497872"
        assert result.companies_updated == 1

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
    async def test_persist_chunk_advances_cursor_only_for_committed_successes(self, update_service):
        company = MagicMock()
        company.last_polled_regnskap = date.today()
        update_service.company_repo.create_or_update = AsyncMock(return_value=company)
        update_service.report_sync_error = AsyncMock()
        update_service._fetch_and_persist_financials = AsyncMock()

        fetch_results = [
            FetchResult(
                orgnr="111111111",
                success=True,
                company_data={"organisasjonsnummer": "111111111"},
                source_update_id="2",
            ),
            FetchResult(orgnr="999999999", success=False, error="API timeout", source_update_id="99"),
        ]
        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-01-26T00:00:00.000Z")

        await update_service._persist_chunk(fetch_results, result)

        assert result.latest_oppdateringsid == 2
        update_service.db.commit.assert_awaited()

    @pytest.mark.asyncio
    async def test_persist_chunk_does_not_advance_cursor_past_earlier_failed_update(self, update_service):
        company = MagicMock()
        company.last_polled_regnskap = date.today()
        update_service.company_repo.create_or_update = AsyncMock(return_value=company)
        update_service.report_sync_error = AsyncMock()
        update_service._fetch_and_persist_financials = AsyncMock()

        fetch_results = [
            FetchResult(orgnr="111111111", success=False, error="API timeout", source_update_id="2"),
            FetchResult(
                orgnr="222222222",
                success=True,
                company_data={"organisasjonsnummer": "222222222"},
                source_update_id="99",
            ),
        ]
        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-01-26T00:00:00.000Z")

        await update_service._persist_chunk(fetch_results, result)

        assert result.latest_oppdateringsid is None
        update_service.db.commit.assert_awaited()

    @pytest.mark.asyncio
    async def test_persist_chunk_does_not_advance_cursor_on_db_error(self, update_service):
        update_service.company_repo.create_or_update = AsyncMock(side_effect=Exception("DB down"))
        update_service._fetch_and_persist_financials = AsyncMock()

        fetch_results = [
            FetchResult(
                orgnr="111111111",
                success=True,
                company_data={"organisasjonsnummer": "111111111"},
                source_update_id="7",
            )
        ]
        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-01-26T00:00:00.000Z")

        await update_service._persist_chunk(fetch_results, result)

        assert result.latest_oppdateringsid is None
        update_service.db.rollback.assert_awaited()

    @pytest.mark.asyncio
    async def test_persist_chunk_treats_rolled_back_pending_ids_as_cursor_gap(self, update_service):
        company = MagicMock()
        company.last_polled_regnskap = date.today()
        update_service.company_repo.create_or_update = AsyncMock(side_effect=[company, Exception("DB down"), company])
        update_service._fetch_and_persist_financials = AsyncMock()

        fetch_results = [
            FetchResult(
                orgnr="111111111",
                success=True,
                company_data={"organisasjonsnummer": "111111111"},
                source_update_id="10",
            ),
            FetchResult(
                orgnr="222222222",
                success=True,
                company_data={"organisasjonsnummer": "222222222"},
                source_update_id="100",
            ),
            FetchResult(
                orgnr="333333333",
                success=True,
                company_data={"organisasjonsnummer": "333333333"},
                source_update_id="50",
            ),
        ]
        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-01-26T00:00:00.000Z")

        cursor_gap_detected = await update_service._persist_chunk(fetch_results, result)

        assert cursor_gap_detected is True
        assert result.latest_oppdateringsid is None

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
    async def test_persist_chunk_blocks_cursor_when_company_delete_fails(self, update_service):
        update_service.company_repo.delete_by_orgnr = AsyncMock(side_effect=Exception("DB down"))
        fetch_results = [
            FetchResult(
                orgnr="123456789",
                success=True,
                company_data=None,
                source_update_id="42",
                source_change_type="Fjernet",
            )
        ]
        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-01-26T00:00:00.000Z")

        cursor_gap_detected = await update_service._persist_chunk(fetch_results, result)

        assert cursor_gap_detected is True
        assert result.latest_oppdateringsid is None
        assert result.db_errors == 1

    @pytest.mark.asyncio
    async def test_persist_chunk_records_fjernet_as_removed_from_open_data(self, update_service):
        update_service.company_repo.delete_by_orgnr = AsyncMock(return_value=1)
        update_service._record_company_event_safe = AsyncMock()

        fetch_results = [
            FetchResult(
                orgnr="123456789",
                success=True,
                company_data=None,
                source_update_id="update-1",
                source_change_type="Fjernet",
            )
        ]
        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-01-26T00:00:00.000Z")

        await update_service._persist_chunk(fetch_results, result)

        update_service._record_company_event_safe.assert_awaited_once()
        assert update_service._record_company_event_safe.await_args.kwargs["event_type"] == (
            "company_removed_from_open_data"
        )
        assert result.companies_deleted == 1

    @pytest.mark.asyncio
    async def test_persist_chunk_records_employee_count_change(self, update_service):
        company = MagicMock()
        company.last_polled_regnskap = date.today()
        update_service.company_repo.create_or_update = AsyncMock(return_value=company)
        update_service._record_company_event_safe = AsyncMock()

        fetch_results = [
            FetchResult(
                orgnr="123456789",
                success=True,
                company_data={"organisasjonsnummer": "123456789", "navn": "Test", "antallAnsatte": 14},
                source_update_id="update-1",
                source_event_time=None,
                source_change_type="Endring",
                source_changes=[{"path": "/antallAnsatte", "op": "replace"}],
            )
        ]
        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-01-26T00:00:00.000Z")
        update_service._get_existing_company_event_snapshots = AsyncMock(
            return_value={"123456789": {"antall_ansatte": 10}}
        )

        await update_service._persist_chunk(fetch_results, result)

        update_service._record_company_event_safe.assert_awaited_once_with(
            orgnr="123456789",
            event_type="employee_count_changed",
            source="Enhetsregisteret via Brreg",
            source_update_id="update-1",
            occurred_at=None,
            previous_value={"antall_ansatte": 10},
            new_value={"antall_ansatte": 14},
            payload={
                "time_semantics": "Tidspunkt fra Brregs oppdateringsstrøm når tilgjengelig.",
                "source_change_type": "Endring",
                "brreg_change_paths": ["/antallAnsatte"],
                "brreg_change_count": 1,
            },
        )

    @pytest.mark.asyncio
    async def test_persist_chunk_records_company_update_events_from_source_changes(self, update_service):
        company = MagicMock()
        company.last_polled_regnskap = date.today()
        update_service.company_repo.create_or_update = AsyncMock(return_value=company)
        update_service._record_company_event_safe = AsyncMock()
        update_service._get_existing_company_event_snapshots = AsyncMock(
            return_value={
                "123456789": {
                    "navn": "Gammelt Navn AS",
                    "postadresse": None,
                    "forretningsadresse": {"postnummer": "0101", "poststed": "OSLO"},
                    "naeringskode": "62.010",
                    "antall_ansatte": 10,
                    "konkurs": False,
                    "konkursdato": None,
                    "under_avvikling": False,
                    "under_tvangsavvikling": False,
                    "raw_data": {
                        "naeringskode1": {"kode": "62.010", "beskrivelse": "Programmeringstjenester"},
                        "aktivitet": "Gammel aktivitet",
                    },
                }
            }
        )

        fetch_results = [
            FetchResult(
                orgnr="123456789",
                success=True,
                company_data={
                    "organisasjonsnummer": "123456789",
                    "navn": "Nytt Navn AS",
                    "forretningsadresse": {"postnummer": "5003", "poststed": "BERGEN"},
                    "naeringskode1": {"kode": "70.220", "beskrivelse": "Bedriftsrådgivning"},
                    "aktivitet": "Ny aktivitet",
                    "antallAnsatte": 10,
                    "konkurs": True,
                    "konkursdato": "2026-05-27",
                    "underAvvikling": False,
                    "underTvangsavvikling": False,
                },
                source_update_id="update-99",
                source_change_type="Endring",
                source_changes=[
                    {"path": "/navn", "op": "replace"},
                    {"path": "/forretningsadresse/postnummer", "op": "replace"},
                    {"path": "/naeringskode1/kode", "op": "replace"},
                    {"path": "/konkurs", "op": "replace"},
                    {"path": "/ukjentFelt", "op": "replace"},
                ],
            )
        ]
        result = UpdateBatchResult(since_date=date.today(), since_iso="2026-01-26T00:00:00.000Z")

        await update_service._persist_chunk(fetch_results, result)

        event_types = [call.kwargs["event_type"] for call in update_service._record_company_event_safe.await_args_list]
        assert event_types == ["name_changed", "address_changed", "industry_changed", "status_changed"]
        first_payload = update_service._record_company_event_safe.await_args_list[0].kwargs["payload"]
        assert first_payload["brreg_change_paths"] == ["/navn"]
        assert first_payload["brreg_change_count"] == 5
        assert result.companies_updated == 1


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

        update_service.brreg_api._get = AsyncMock(return_value=mock_resp)

        result = await update_service.fetch_subunit_updates(page_size=10)

        # Result should have proper structure
        assert isinstance(result, dict)
        assert "errors" in result or "since_date" in result

    @pytest.mark.asyncio
    async def test_handles_api_error_response(self, update_service, mock_db):
        """Should handle non-200 API response."""
        mock_resp = MagicMock(status_code=500)

        update_service.brreg_api._get = AsyncMock(return_value=mock_resp)

        result = await update_service.fetch_subunit_updates(page_size=10)

        # Should return result dict with errors
        assert isinstance(result, dict)
