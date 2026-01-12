import pytest
import httpx
from unittest.mock import MagicMock, AsyncMock, patch
from services.base_external_service import BaseExternalService, ExternalApiException

# Concrete implementation for testing
class TestService(BaseExternalService):
    SERVICE_NAME = "TestService"
    BASE_URL = "http://test.com"
    
    async def get_resource(self):
        return await self._get(f"{self.BASE_URL}/resource")

@pytest.fixture
def mock_httpx_client():
    client = AsyncMock(spec=httpx.AsyncClient)
    return client

@pytest.fixture
def service(mock_httpx_client):
    return TestService(client=mock_httpx_client)

@pytest.mark.asyncio
async def test_get_success(service, mock_httpx_client):
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_response.json.return_value = {"data": "ok"}
    mock_httpx_client.get.return_value = mock_response
    
    response = await service.get_resource()
    assert response.status_code == 200
    assert mock_httpx_client.get.called

@pytest.mark.asyncio
async def test_retry_on_error(service, mock_httpx_client):
    # First fail 500, then succeed 200
    fail_response = MagicMock(spec=httpx.Response)
    fail_response.status_code = 500
    
    success_response = MagicMock(spec=httpx.Response)
    success_response.status_code = 200
    
    mock_httpx_client.get.side_effect = [fail_response, success_response]
    
    # Speed up delay for test
    service.RETRY_DELAY = 0.01
    
    response = await service.get_resource()
    assert response.status_code == 200
    assert mock_httpx_client.get.call_count == 2

@pytest.mark.asyncio
async def test_max_retries_exceeded(service, mock_httpx_client):
    fail_response = MagicMock(spec=httpx.Response)
    fail_response.status_code = 500
    mock_httpx_client.get.return_value = fail_response
    
    service.RETRY_DELAY = 0.001
    service.RETRY_ATTEMPTS = 2
    
    with pytest.raises(ExternalApiException) as exc:
        await service.get_resource()
    
    assert "Failed to fetch" in str(exc.value)
    assert mock_httpx_client.get.call_count == 2

@pytest.mark.asyncio
async def test_timeout_handling(service, mock_httpx_client):
    mock_httpx_client.get.side_effect = httpx.TimeoutException("Timeout")
    
    service.RETRY_DELAY = 0.001
    service.RETRY_ATTEMPTS = 2
    
    with pytest.raises(ExternalApiException) as exc:
        await service.get_resource()
    
    assert "Timeout fetching" in str(exc.value)

@pytest.mark.asyncio
async def test_rate_limit_backoff(service, mock_httpx_client):
    # 429 then 200
    rate_limit_resp = MagicMock(spec=httpx.Response)
    rate_limit_resp.status_code = 429
    
    success_resp = MagicMock(spec=httpx.Response)
    success_resp.status_code = 200
    
    mock_httpx_client.get.side_effect = [rate_limit_resp, success_resp]
    service.RETRY_DELAY = 0.001
    
    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        response = await service.get_resource()
        assert response.status_code == 200
        assert mock_sleep.called
