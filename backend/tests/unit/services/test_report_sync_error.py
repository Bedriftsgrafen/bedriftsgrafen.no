import pytest
from unittest.mock import AsyncMock, MagicMock
from services.update_service import UpdateService
import models


@pytest.mark.asyncio
async def test_report_sync_error_no_autoflush():
    # Arrange
    mock_db = AsyncMock()
    # Mock no_autoflush to be a synchronous context manager
    mock_db.no_autoflush = MagicMock()
    mock_db.no_autoflush.__enter__ = MagicMock()
    mock_db.no_autoflush.__exit__ = MagicMock()

    # Mock result for existence check
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    service = UpdateService(mock_db)

    # Act
    await service.report_sync_error("999999999", "company", "Some error")

    # Assert
    # Verify no_autoflush was used
    mock_db.no_autoflush.__enter__.assert_called_once()
    mock_db.execute.assert_called_once()
    # Verify add was called (since scalar_one_or_none returned None)
    mock_db.add.assert_called_once()
    # Check that status was passed as a string
    new_error = mock_db.add.call_args[0][0]
    assert isinstance(new_error.status, str)
    assert new_error.status == models.SyncErrorStatus.PENDING.value


@pytest.mark.asyncio
async def test_report_sync_error_updates_existing():
    # Arrange
    mock_db = AsyncMock()
    mock_db.no_autoflush = MagicMock()
    mock_db.no_autoflush.__enter__ = MagicMock()
    mock_db.no_autoflush.__exit__ = MagicMock()

    existing_error = MagicMock()
    existing_error.attempt_count = 1

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = existing_error
    mock_db.execute.return_value = mock_result

    service = UpdateService(mock_db)

    # Act
    await service.report_sync_error("999999999", "company", "New error message")

    # Assert
    assert existing_error.error_message == "New error message"
    assert existing_error.attempt_count == 2
    mock_db.add.assert_not_called()
