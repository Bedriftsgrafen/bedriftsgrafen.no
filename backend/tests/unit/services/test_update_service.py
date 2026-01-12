"""
Unit tests for UpdateService.

Tests incremental update fetching and processing phases.
Follows AAA pattern (Arrange - Act - Assert).
"""

import pytest
from datetime import date, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

from services.update_service import UpdateService


class TestUpdateServiceInit:
    """Tests for UpdateService initialization."""

    def test_init_sets_repositories(self):
        # Arrange
        mock_db = AsyncMock()

        # Act
        service = UpdateService(mock_db)

        # Assert
        assert service.db == mock_db
        assert service.brreg_api is not None
        assert service.company_repo is not None
        assert service.accounting_repo is not None
        assert service.system_repo is not None


class TestFetchUpdates:
    """Tests for the main update fetching workflow."""

    @pytest.mark.asyncio
    async def test_fetch_updates_defaults_to_yesterday(self):
        # Arrange
        mock_db = AsyncMock()
        service = UpdateService(mock_db)
        
        # Mocking the internal methods to isolate fetch_updates logic
        service._fetch_and_process_page = AsyncMock()
        service._refresh_materialized_view = AsyncMock()
        
        # Act
        with patch('services.update_service.UpdateBatchResult', return_value=MagicMock()) as mock_result_class:
            await service.fetch_updates()
            
            # Assert
            yesterday = date.today() - timedelta(days=1)
            mock_result_class.assert_called_once()
            args, kwargs = mock_result_class.call_args
            assert kwargs['since_date'] == yesterday

    @pytest.mark.asyncio
    async def test_fetch_updates_with_specific_date(self):
        # Arrange
        mock_db = AsyncMock()
        service = UpdateService(mock_db)
        service._fetch_and_process_page = AsyncMock()
        service._refresh_materialized_view = AsyncMock()
        
        test_date = date(2023, 1, 1)

        # Act
        with patch('services.update_service.UpdateBatchResult', return_value=MagicMock()) as mock_result_class:
            await service.fetch_updates(since_date=test_date)
            
            # Assert
            kwargs = mock_result_class.call_args[1]
            assert kwargs['since_date'] == test_date

    @pytest.mark.asyncio
    async def test_fetch_updates_handles_empty_response(self):
        # Arrange
        mock_db = AsyncMock()
        service = UpdateService(mock_db)
        service._refresh_materialized_view = AsyncMock()
        
        # Mock httpx response for empty updates list
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "_embedded": {"oppdaterteEnheter": []},
            "page": {"totalElements": 0}
        }

        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            # Act
            result = await service.fetch_updates()
            
            # Assert
            assert result['companies_processed'] == 0
            assert result['companies_updated'] == 0
            assert result['api_errors'] == 0

    @pytest.mark.asyncio
    async def test_fetch_updates_processes_multiple_pages(self):
        # Arrange
        mock_db = AsyncMock()
        service = UpdateService(mock_db)
        
        # Mock internal methods to avoid real logic
        # process_single_page needs to return the next URL for the first call, then None for the second
        service._process_single_page = AsyncMock(side_effect=[
            "http://api.brreg.no/updates?page=2",  # First call returns next URL
            None                                   # Second call returns None (stop)
        ])
        service._refresh_materialized_view = AsyncMock()

        with patch("httpx.AsyncClient") as _:
            # We don't need to mock get() here because we mocked _process_single_page which calls it
            # But the service uses the client in a context manager, so we need the patch
            
            # Act
            result = await service.fetch_updates(page_size=1)
            
            # Assert
            assert service._process_single_page.call_count == 2
            # Verify result contains aggregated counts (we mocked the return, so we can't verify actual aggregation logic here easily without more complex mocking,
            # but we verified the loop flow)
            assert result['companies_processed'] == 0 # Since we mocked _process_single_page to return just URL/None, aggregation inside fetch_updates won't happen unless we mock that too. 
            # However, the test intent is to verify pagination lopp.
            # Let's adjust the test to verify arguments passed to _process_single_page
            
            call_args_list = service._process_single_page.call_args_list
            assert len(call_args_list) == 2
            # First call
            assert "oppdateringsid" in call_args_list[0].kwargs['url'] or "dato" in call_args_list[0].kwargs['url']
            # Second call
            assert call_args_list[1].kwargs['url'] == "http://api.brreg.no/updates?page=2"


class TestUpdateBatchResult:
    """Tests for the UpdateBatchResult schema/helper."""

    def test_result_initialization(self):
        from schemas.brreg import UpdateBatchResult
        test_date = date(2023, 1, 1)
        res = UpdateBatchResult(since_date=test_date, since_iso="2023-01-01T00:00:00Z")
        
        assert res.companies_processed == 0
        assert res.companies_updated == 0
        assert res.api_errors == 0
        assert res.since_date == test_date
