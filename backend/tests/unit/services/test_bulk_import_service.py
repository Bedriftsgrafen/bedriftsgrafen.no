from unittest.mock import AsyncMock, MagicMock

import pytest

from services.bulk_import_service import BulkImportService


# Mock CompanyService since it is a dependency
@pytest.fixture
def mock_company_service(monkeypatch):
    service_mock = AsyncMock()
    # Mocking the CLASS instantiation inside BulkImportService
    monkeypatch.setattr("services.bulk_import_service.CompanyService", MagicMock(return_value=service_mock))
    return service_mock


@pytest.fixture
def service(mock_db_session, mock_company_service):
    # mock_db_session is from conftest usually, but we need to define it if not present.
    # Assuming conftest.py exists with session mocks, or we define it here.
    return BulkImportService(mock_db_session)


@pytest.fixture
def mock_db_session():
    session = AsyncMock()
    # Synchronous methods - use MagicMock (not AsyncMock) to avoid unawaited coroutine warnings
    session.add = MagicMock()
    session.add_all = MagicMock()
    session.expunge = MagicMock()

    # Create a MagicMock for the result object (NOT AsyncMock)
    mock_result = MagicMock()
    # Default behavior: scalar_one_or_none returns None (not found)
    mock_result.scalar_one_or_none.return_value = None

    # Ensure await session.execute() returns this mock_result
    session.execute.return_value = mock_result
    return session


@pytest.mark.asyncio
async def test_populate_queue_new_items(service, mock_db_session):
    # Arrange
    orgnr_list = ["123456789", "987654321"]

    # Mock checks for existing items
    mock_db_session.execute.return_value.scalar_one_or_none.return_value = None

    # Act
    stats = await service.populate_queue(orgnr_list)

    # Assert
    assert stats["added"] == 2
    assert stats["skipped"] == 0
    assert mock_db_session.add.call_count == 2
    assert mock_db_session.commit.call_count > 0


@pytest.mark.asyncio
async def test_populate_queue_skip_existing(service, mock_db_session):
    # Arrange
    orgnr_list = ["123456789"]

    # Mock checking existing - return a Dummy object
    mock_db_session.execute.return_value.scalar_one_or_none.return_value = MagicMock()

    # Act
    stats = await service.populate_queue(orgnr_list)

    # Assert
    assert stats["added"] == 0
    assert stats["skipped"] == 1
    assert mock_db_session.add.call_count == 0


@pytest.mark.asyncio
async def test_process_single_company_success(service, mock_company_service):
    # Arrange
    mock_company_service.fetch_and_store_company.return_value = {
        "company_fetched": True,
        "financials_fetched": 2,
        "errors": [],
    }

    # Act
    result = await service.process_single_company("123456789")

    # Assert
    assert result["company_fetched"] is True
    assert result["financials_count"] == 2
    assert result["error"] is None
    # Ensure geocoding was disabled for bulk import
    mock_company_service.fetch_and_store_company.assert_awaited_with("123456789", fetch_financials=True, geocode=False)


@pytest.mark.asyncio
async def test_process_single_company_failure(service, mock_company_service):
    # Arrange
    mock_company_service.fetch_and_store_company.side_effect = Exception("API fetch error")

    # Act
    result = await service.process_single_company("123456789")

    # Assert
    assert result["error"] == "API fetch error"
    assert result["company_fetched"] is False


@pytest.mark.asyncio
async def test_retry_failed(service, mock_db_session):
    # Arrange
    mock_db_session.execute.return_value.rowcount = 5

    # Act
    count = await service.retry_failed()

    # Assert
    assert count == 5
    # Should check that an UPDATE statement was executed
    assert mock_db_session.execute.call_count == 1
    # We could inspect the call args to verify it's an update statement,


@pytest.mark.asyncio
async def test_get_progress_counts_all_statuses(service, mock_db_session):
    """get_progress should return counts for each ImportStatus."""
    # Arrange - mock count results for each status
    from models_import import ImportStatus

    status_counts = {
        ImportStatus.PENDING: 100,
        ImportStatus.IN_PROGRESS: 5,
        ImportStatus.COMPLETED: 500,
        ImportStatus.FAILED: 10,
    }

    # Mock execute to return different counts based on call order
    mock_results = []
    for status in ImportStatus:
        mock_result = MagicMock()
        mock_result.scalar.return_value = status_counts.get(status, 0)
        mock_results.append(mock_result)

    mock_db_session.execute.side_effect = mock_results

    # Act
    result = await service.get_progress()

    # Assert
    assert result["total"] == 615  # 100 + 5 + 500 + 10
    assert result["progress_percentage"] == pytest.approx(81.30, rel=0.1)  # 500/615*100


@pytest.mark.asyncio
async def test_get_progress_handles_empty_queue(service, mock_db_session):
    """get_progress should handle empty queue gracefully."""

    # All counts return 0
    mock_result = MagicMock()
    mock_result.scalar.return_value = 0
    mock_db_session.execute.return_value = mock_result

    # Act
    result = await service.get_progress()

    # Assert
    assert result["total"] == 0
    assert result["progress_percentage"] == 0.0


@pytest.mark.asyncio
async def test_populate_queue_batches_commits(service, mock_db_session):
    """populate_queue should commit in batches of 1000."""
    # Arrange - generate 2500 orgnrs
    orgnr_list = [f"{i:09d}" for i in range(2500)]
    mock_db_session.execute.return_value.scalar_one_or_none.return_value = None

    # Act
    stats = await service.populate_queue(orgnr_list)

    # Assert
    assert stats["added"] == 2500
    # Should commit at 1000, 2000, and final commit = 3 total
    assert mock_db_session.commit.call_count == 3


@pytest.mark.asyncio
async def test_populate_queue_with_priority(service, mock_db_session):
    """populate_queue should set priority on queue items."""
    # Arrange
    orgnr_list = ["123456789"]
    mock_db_session.execute.return_value.scalar_one_or_none.return_value = None

    # Act
    stats = await service.populate_queue(orgnr_list, priority=5)

    # Assert
    assert stats["added"] == 1
    # Check the added item has correct priority
    add_call = mock_db_session.add.call_args
    queue_item = add_call[0][0]
    assert queue_item.priority == 5


class TestWorker:
    """Tests for the async worker processing."""

    @pytest.mark.asyncio
    async def test_worker_exits_on_empty_queue(self, service, mock_db_session):
        """Worker should exit when queue is empty."""
        import asyncio

        # Mock no items in queue
        mock_db_session.execute.return_value.scalar_one_or_none.return_value = None

        semaphore = asyncio.Semaphore(10)

        # Act - should complete without hanging
        await service.worker(1, semaphore)

        # Assert - should have tried to fetch
        assert mock_db_session.execute.call_count >= 1

    @pytest.mark.asyncio
    async def test_worker_processes_and_marks_completed(self, service, mock_db_session, mock_company_service):
        """Worker should process company and mark as completed on success."""
        import asyncio

        from models_import import ImportStatus

        # Arrange - mock queue item
        mock_queue_item = MagicMock()
        mock_queue_item.orgnr = "123456789"
        mock_queue_item.status = ImportStatus.PENDING
        mock_queue_item.attempt_count = 0

        # First call returns item, second call returns None (exit)
        mock_db_session.execute.return_value.scalar_one_or_none.side_effect = [mock_queue_item, None]

        mock_company_service.fetch_and_store_company.return_value = {
            "company_fetched": True,
            "financials_fetched": 2,
            "errors": [],
        }

        semaphore = asyncio.Semaphore(10)

        # Act
        await service.worker(1, semaphore)

        # Assert
        assert mock_queue_item.status == ImportStatus.COMPLETED
        assert mock_queue_item.company_fetched == 1
        assert mock_queue_item.financials_count == 2

    @pytest.mark.asyncio
    async def test_worker_marks_failed_on_error(self, service, mock_db_session, mock_company_service):
        """Worker should mark item as failed when processing raises exception."""
        import asyncio

        from models_import import ImportStatus

        # Arrange
        mock_queue_item = MagicMock()
        mock_queue_item.orgnr = "123456789"
        mock_queue_item.status = ImportStatus.PENDING
        mock_queue_item.attempt_count = 0

        mock_db_session.execute.return_value.scalar_one_or_none.side_effect = [mock_queue_item, None]

        mock_company_service.fetch_and_store_company.side_effect = Exception("API error")

        semaphore = asyncio.Semaphore(10)

        # Act
        await service.worker(1, semaphore)

        # Assert
        assert mock_queue_item.status == ImportStatus.FAILED
        assert "API error" in mock_queue_item.last_error


class TestStartBulkImport:
    """Tests for the main bulk import orchestration."""

    @pytest.mark.asyncio
    async def test_start_bulk_import_creates_batch(self, service, mock_db_session, mock_company_service):
        """start_bulk_import should create an ImportBatch record."""
        # Arrange - empty queue (workers exit immediately)
        mock_result = MagicMock()
        mock_result.scalar.return_value = 0
        mock_result.scalar_one_or_none.return_value = None
        mock_db_session.execute.return_value = mock_result

        # Act
        result = await service.start_bulk_import(batch_name="test-batch")

        # Assert
        assert result["batch_name"] == "test-batch"
        assert result["total"] == 0
        assert mock_db_session.add.call_count >= 1  # batch record added

    # but rowcount check is a decent proxy for now.
