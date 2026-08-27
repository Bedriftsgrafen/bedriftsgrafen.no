import logging
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from services.base_external_service import (
    _CIRCUIT_COOLDOWN_SECONDS,
    _CIRCUIT_FAILURE_THRESHOLD,
    _CIRCUIT_WINDOW_SECONDS,
    BaseExternalService,
    CircuitOpenException,
    ExternalApiException,
    _CircuitState,
)


# Concrete implementation for testing (prefixed with _ to avoid pytest collection)
class _MockExternalService(BaseExternalService):
    SERVICE_NAME = "MockExternalService"
    BASE_URL = "http://test.com"

    async def get_resource(self):
        return await self._get(f"{self.BASE_URL}/resource")


class _MockBrregService(BaseExternalService):
    SERVICE_NAME = "Brønnøysund"
    BASE_URL = "http://test.com"

    async def get_company(self):
        return await self._get(f"{self.BASE_URL}/company", context="company 123456789")

    async def get_roles(self):
        return await self._get(f"{self.BASE_URL}/roles", context="roles 123456789")


@pytest.fixture
def mock_httpx_client():
    client = AsyncMock(spec=httpx.AsyncClient)
    return client


@pytest.fixture
def service(mock_httpx_client):
    return _MockExternalService(client=mock_httpx_client)


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
    assert exc.value.status_code == 500
    assert mock_httpx_client.get.call_count == 2


@pytest.mark.asyncio
async def test_timeout_handling(service, mock_httpx_client):
    mock_httpx_client.get.side_effect = httpx.TimeoutException("Timeout")

    service.RETRY_DELAY = 0.001
    service.RETRY_ATTEMPTS = 2

    with pytest.raises(ExternalApiException) as exc:
        await service.get_resource()

    assert "Timeout fetching" in str(exc.value)
    assert exc.value.status_code is None


@pytest.mark.asyncio
async def test_brreg_request_metric_records_success(mock_httpx_client, monkeypatch):
    monkeypatch.setenv("BRREG_EGRESS_GUARD_ENABLED", "false")
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = 200
    mock_httpx_client.get.return_value = mock_response

    service = _MockBrregService(client=mock_httpx_client)

    with patch("services.base_external_service.BRREG_API_REQUESTS_TOTAL") as mock_metric:
        response = await service.get_company()

    assert response.status_code == 200
    mock_metric.labels.assert_called_once_with(endpoint="company", status_code="200")
    mock_metric.labels.return_value.inc.assert_called_once_with()


@pytest.mark.asyncio
async def test_brreg_request_metric_records_timeout(mock_httpx_client, monkeypatch):
    monkeypatch.setenv("BRREG_EGRESS_GUARD_ENABLED", "false")
    mock_httpx_client.get.side_effect = httpx.TimeoutException("Timeout")

    service = _MockBrregService(client=mock_httpx_client)
    service.RETRY_DELAY = 0.001
    service.RETRY_ATTEMPTS = 1

    with patch("services.base_external_service.BRREG_API_REQUESTS_TOTAL") as mock_metric:
        with pytest.raises(ExternalApiException):
            await service.get_roles()

    mock_metric.labels.assert_called_once_with(endpoint="roles", status_code="timeout")
    mock_metric.labels.return_value.inc.assert_called_once_with()


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


# ---------------------------------------------------------------------------
# Circuit breaker tests
# ---------------------------------------------------------------------------


@pytest.fixture
def fresh_service(mock_httpx_client):
    """Service with a clean circuit breaker state."""
    svc = _MockExternalService(client=mock_httpx_client)
    _MockExternalService._reset_circuit_state()
    return svc


@pytest.mark.asyncio
async def test_circuit_opens_after_threshold_failures(fresh_service, mock_httpx_client):
    """Circuit should open after CIRCUIT_FAILURE_THRESHOLD consecutive failures."""
    fail_response = MagicMock(spec=httpx.Response)
    fail_response.status_code = 500
    mock_httpx_client.get.return_value = fail_response

    fresh_service.RETRY_DELAY = 0.0
    fresh_service.RETRY_ATTEMPTS = 1

    for _ in range(_CIRCUIT_FAILURE_THRESHOLD):
        with pytest.raises(ExternalApiException):
            await fresh_service.get_resource()

    assert _MockExternalService._circuit_states["request"].open_until > 0


@pytest.mark.asyncio
async def test_retries_count_as_one_circuit_failure(fresh_service, mock_httpx_client):
    """Internal HTTP retries belong to one logical circuit outcome."""
    fail_response = MagicMock(spec=httpx.Response)
    fail_response.status_code = 500
    mock_httpx_client.get.return_value = fail_response
    fresh_service.RETRY_DELAY = 0.0
    fresh_service.RETRY_ATTEMPTS = 3

    with pytest.raises(ExternalApiException):
        await fresh_service.get_resource()

    assert mock_httpx_client.get.await_count == 3
    assert _MockExternalService._circuit_states["request"].failure_count == 1


@pytest.mark.asyncio
async def test_circuit_blocks_requests_when_open(fresh_service):
    """Once the circuit is open, requests should fail immediately without hitting transport."""
    import time

    _MockExternalService._circuit_states["request"] = _CircuitState(
        failure_count=_CIRCUIT_FAILURE_THRESHOLD,
        open_until=time.monotonic() + _CIRCUIT_COOLDOWN_SECONDS,
    )

    with pytest.raises(CircuitOpenException, match="Circuit open"):
        await fresh_service.get_resource()


@pytest.mark.asyncio
async def test_circuit_resets_on_success(fresh_service, mock_httpx_client, caplog):
    """A success after cooldown should close the circuit and reset the counter."""
    import time

    # Cooldown expired
    _MockExternalService._circuit_states["request"] = _CircuitState(
        failure_count=_CIRCUIT_FAILURE_THRESHOLD,
        open_until=time.monotonic() - 1.0,
        has_opened=True,
    )

    success_resp = MagicMock(spec=httpx.Response)
    success_resp.status_code = 200
    mock_httpx_client.get.return_value = success_resp

    with caplog.at_level(logging.INFO, logger="services.base_external_service"):
        response = await fresh_service.get_resource()

    assert response.status_code == 200
    assert "request" not in _MockExternalService._circuit_states
    assert "external.circuit_closed endpoint=request" in caplog.text


def test_success_after_ordinary_failure_does_not_log_circuit_closed(fresh_service, caplog):
    """A normal failure streak is not a circuit-open transition."""
    fresh_service._record_failure("request")

    with caplog.at_level(logging.INFO, logger="services.base_external_service"):
        fresh_service._record_success("request")

    assert "circuit_closed" not in caplog.text
    assert "request" not in _MockExternalService._circuit_states


@pytest.mark.asyncio
async def test_failure_counter_resets_outside_window(fresh_service, mock_httpx_client):
    """Failures older than the window should not count toward the threshold."""
    import time

    # Simulate old failures (outside rolling window)
    _MockExternalService._circuit_states["request"] = _CircuitState(
        failure_count=_CIRCUIT_FAILURE_THRESHOLD - 1,
        last_failure_time=time.monotonic() - _CIRCUIT_WINDOW_SECONDS - 1,
    )

    fail_response = MagicMock(spec=httpx.Response)
    fail_response.status_code = 500
    mock_httpx_client.get.return_value = fail_response
    fresh_service.RETRY_DELAY = 0.0
    fresh_service.RETRY_ATTEMPTS = 1

    with pytest.raises(ExternalApiException):
        await fresh_service.get_resource()

    # Counter should have been reset to 1 (only the new failure)
    assert _MockExternalService._circuit_states["request"].failure_count == 1
    assert _MockExternalService._circuit_states["request"].open_until == 0.0


@pytest.mark.asyncio
async def test_open_circuit_is_isolated_to_endpoint(mock_httpx_client, monkeypatch):
    """A financial-style endpoint failure must not block or reset another endpoint."""
    import time

    monkeypatch.setenv("BRREG_EGRESS_GUARD_ENABLED", "false")
    service = _MockBrregService(client=mock_httpx_client)
    _MockBrregService._reset_circuit_state()
    _MockBrregService._circuit_states["company"] = _CircuitState(
        failure_count=_CIRCUIT_FAILURE_THRESHOLD,
        open_until=time.monotonic() + _CIRCUIT_COOLDOWN_SECONDS,
    )
    success_resp = MagicMock(spec=httpx.Response)
    success_resp.status_code = 200
    mock_httpx_client.get.return_value = success_resp
    try:
        with pytest.raises(CircuitOpenException, match="Circuit open"):
            await service.get_company()

        response = await service.get_roles()

        assert response.status_code == 200
        mock_httpx_client.get.assert_awaited_once()
        assert "company" in _MockBrregService._circuit_states
        assert "roles" not in _MockBrregService._circuit_states
    finally:
        _MockBrregService._reset_circuit_state()


def test_circuit_state_is_isolated_between_service_subclasses():
    """Mutable circuit maps must not leak between service subclasses."""
    _MockExternalService._reset_circuit_state()
    _MockBrregService._reset_circuit_state()
    try:
        _MockExternalService._circuit_states["request"] = _CircuitState(failure_count=1)

        assert _MockBrregService._circuit_states == {}
    finally:
        _MockExternalService._reset_circuit_state()
        _MockBrregService._reset_circuit_state()


@pytest.mark.asyncio
async def test_jitter_applied_to_retry_delay(fresh_service, mock_httpx_client):
    """Retry delay should include jitter (not be a fixed value)."""
    fail_response = MagicMock(spec=httpx.Response)
    fail_response.status_code = 500

    success_resp = MagicMock(spec=httpx.Response)
    success_resp.status_code = 200

    mock_httpx_client.get.side_effect = [fail_response, success_resp]
    fresh_service.RETRY_DELAY = 1.0
    fresh_service.RETRY_ATTEMPTS = 2

    sleep_calls = []
    with patch("asyncio.sleep", new_callable=AsyncMock) as mock_sleep:
        mock_sleep.side_effect = lambda t: sleep_calls.append(t)
        await fresh_service.get_resource()

    assert len(sleep_calls) == 1
    # Jitter range: 0.8 * 1.0 to 1.2 * 1.0
    assert 0.8 <= sleep_calls[0] <= 1.2
