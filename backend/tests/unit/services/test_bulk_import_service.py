import pytest
from unittest.mock import AsyncMock, MagicMock
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
        "errors": []
    }
    
    # Act
    result = await service.process_single_company("123456789")
    
    # Assert
    assert result["company_fetched"] is True
    assert result["financials_count"] == 2
    assert result["error"] is None
    # Ensure geocoding was disabled for bulk import
    mock_company_service.fetch_and_store_company.assert_awaited_with(
        "123456789", fetch_financials=True, geocode=False
    )

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
    # but rowcount check is a decent proxy for now.
