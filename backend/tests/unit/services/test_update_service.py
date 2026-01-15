"""
Unit tests for UpdateService.

Tests incremental update fetching and processing phases.
Follows AAA pattern (Arrange - Act - Assert).
"""

import pytest
from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from services.update_service import UpdateService


@pytest.fixture
def mock_db():
    db = AsyncMock()
    db.add = MagicMock()  # session.add is sync
    return db


@pytest.fixture
def update_service(mock_db):
    return UpdateService(mock_db)


class TestUpdateServiceInit:
    """Tests for UpdateService initialization."""

    def test_init_sets_repositories(self, mock_db):
        service = UpdateService(mock_db)
        assert service.db == mock_db
        assert service.brreg_api is not None
        assert service.company_repo is not None
        assert service.subunit_repo is not None
        assert service.role_repo is not None


class TestFetchUpdates:
    """Tests for the main update fetching workflow."""

    @pytest.mark.asyncio
    async def test_fetch_updates_defaults_to_yesterday(self, update_service):
        update_service._process_single_page = AsyncMock(return_value=None)
        update_service._refresh_materialized_view = AsyncMock()

        with patch("services.update_service.UpdateBatchResult") as mock_result_class:
            await update_service.fetch_updates()
            yesterday = date.today() - timedelta(days=1)
            mock_result_class.assert_called_once()
            _, kwargs = mock_result_class.call_args
            assert kwargs["since_date"] == yesterday

    @pytest.mark.asyncio
    async def test_fetch_updates_processes_multiple_pages(self, update_service):
        update_service._process_single_page = AsyncMock(side_effect=["http://next", None])
        update_service._refresh_materialized_view = AsyncMock()

        with patch("httpx.AsyncClient"):
            result = await update_service.fetch_updates(page_size=1)
            assert update_service._process_single_page.call_count == 2
            assert result["companies_processed"] == 0


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
    async def test_fetch_subunit_updates_skips_permanently_missing_parents(self, update_service):
        mock_page_response = MagicMock(status_code=200)
        mock_page_response.json.return_value = {
            "_embedded": {"oppdaterteUnderenheter": [{"organisasjonsnummer": "123"}]},
            "_links": {},
        }
        update_service.brreg_api.fetch_subunit = AsyncMock(
            return_value={"organisasjonsnummer": "123", "overordnetEnhet": "ghost"}
        )
        update_service.company_repo.get_existing_orgnrs = AsyncMock(return_value=set())
        update_service.brreg_api.fetch_company = AsyncMock(return_value=None)
        update_service.subunit_repo.create_batch = AsyncMock()

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get.return_value = mock_page_response
            await update_service.fetch_subunit_updates(page_size=10)
            assert update_service.subunit_repo.create_batch.call_count == 0


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
            update_service.role_repo.create_batch = AsyncMock()

            # 3. Act - important: page_size must be > 1 to not loop on our mocked page 1
            await update_service.fetch_role_updates(page_size=10)

            # 4. Assert
            update_service._ensure_parent_companies_exist.assert_called_once()
            update_service.role_repo.create_batch.assert_called_once()
            mock_db.commit.assert_called()

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

        # 500 for anything should be recorded
        await update_service.report_sync_error("456", "accounting", "Error", status_code=500)
        assert mock_db.add.call_count == 2
