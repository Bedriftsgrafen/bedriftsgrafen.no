"""
Unit tests for BulkImportService.

Tests queue population, batch processing, and import worker logic.
Follows AAA pattern (Arrange - Act - Assert).
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from services.bulk_import_service import BulkImportService


class TestBulkImportServiceInit:
    """Tests for BulkImportService initialization."""

    def test_init_sets_default_config(self):
        # Arrange
        mock_db = MagicMock()

        # Act
        service = BulkImportService(mock_db)

        # Assert
        assert service.db == mock_db
        assert service.requests_per_second == 10
        assert service.max_concurrent_workers == 5
        assert service.batch_size == 100

    def test_init_creates_company_service(self):
        # Arrange
        mock_db = MagicMock()

        # Act
        service = BulkImportService(mock_db)

        # Assert
        assert service.company_service is not None


class TestPopulateQueue:
    """Tests for queue population logic."""

    @pytest.mark.asyncio
    async def test_populate_queue_adds_new_items(self):
        # Arrange
        mock_db = MagicMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()
        mock_db.add = MagicMock()

        # Mock no existing items
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        service = BulkImportService(mock_db)
        orgnr_list = ["123456789", "987654321"]

        # Act
        result = await service.populate_queue(orgnr_list)

        # Assert
        assert result["added"] == 2
        assert result["skipped"] == 0
        assert mock_db.add.call_count == 2

    @pytest.mark.asyncio
    async def test_populate_queue_skips_existing_items(self):
        # Arrange
        mock_db = MagicMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()
        mock_db.add = MagicMock()

        # Mock existing item
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = MagicMock()  # Existing
        mock_db.execute.return_value = mock_result

        service = BulkImportService(mock_db)

        # Act
        result = await service.populate_queue(["123456789"])

        # Assert
        assert result["added"] == 0
        assert result["skipped"] == 1
        assert mock_db.add.call_count == 0

    @pytest.mark.asyncio
    async def test_populate_queue_commits_in_batches(self):
        # Arrange
        mock_db = MagicMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()
        mock_db.add = MagicMock()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        service = BulkImportService(mock_db)

        # Create 2500 items (2 batch commits at 1000, plus final commit)
        orgnr_list = [f"{i:09d}" for i in range(2500)]

        # Act
        result = await service.populate_queue(orgnr_list)

        # Assert
        assert result["added"] == 2500
        # Should have called commit at 1000, 2000, and final
        assert mock_db.commit.call_count == 3

    @pytest.mark.asyncio
    async def test_populate_queue_with_priority(self):
        # Arrange
        mock_db = MagicMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()

        captured_items = []
        mock_db.add = MagicMock(side_effect=lambda x: captured_items.append(x))

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        service = BulkImportService(mock_db)

        # Act
        await service.populate_queue(["123456789"], priority=5)

        # Assert
        assert len(captured_items) == 1
        assert captured_items[0].priority == 5


class TestPopulateFromFile:
    """Tests for file-based queue population."""

    @pytest.mark.asyncio
    async def test_populate_from_file_reads_json(self):
        # Arrange
        mock_db = MagicMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()
        mock_db.add = MagicMock()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        service = BulkImportService(mock_db)

        # Mock file content
        mock_json_data = [
            {"organisasjonsnummer": "123456789", "navn": "Test AS"},
            {"organisasjonsnummer": "987654321", "navn": "Another AS"},
        ]

        with patch("builtins.open", MagicMock()):
            with patch("json.load", return_value=mock_json_data):
                # Act
                result = await service.populate_from_file("/path/to/file.json")

        # Assert
        assert result["added"] == 2

    @pytest.mark.asyncio
    async def test_populate_from_file_skips_missing_orgnr(self):
        # Arrange
        mock_db = MagicMock()
        mock_db.execute = AsyncMock()
        mock_db.commit = AsyncMock()
        mock_db.add = MagicMock()

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_db.execute.return_value = mock_result

        service = BulkImportService(mock_db)

        # Mock file with some items missing orgnr
        mock_json_data = [
            {"organisasjonsnummer": "123456789"},
            {"navn": "No orgnr AS"},  # Missing orgnr
            {"organisasjonsnummer": "987654321"},
        ]

        with patch("builtins.open", MagicMock()):
            with patch("json.load", return_value=mock_json_data):
                # Act
                result = await service.populate_from_file("/path/to/file.json")

        # Assert - only 2 valid items
        assert result["added"] == 2


class TestGetQueueStats:
    """Tests for queue statistics retrieval."""

    @pytest.mark.asyncio
    async def test_rate_limiting_config(self):
        # Arrange
        mock_db = MagicMock()
        service = BulkImportService(mock_db)

        # Assert rate limiting is configured correctly
        assert service.requests_per_second > 0
        assert service.max_concurrent_workers > 0
        assert service.batch_size > 0

        # Verify conservative defaults per docstring
        assert service.requests_per_second <= 20  # Conservative
        assert service.max_concurrent_workers <= 10  # Conservative
