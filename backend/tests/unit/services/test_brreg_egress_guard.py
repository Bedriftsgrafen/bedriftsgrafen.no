import asyncio
import time
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from redis.exceptions import RedisError

from services.base_external_service import BaseExternalService, ExternalApiException
from services.brreg_egress_guard import (
    BrregEgressGuardConfig,
    BrregEgressGuardError,
    acquire_brreg_egress_capacity,
    load_brreg_egress_guard_config,
)


class FakeTokenBucketRedis:
    def __init__(self) -> None:
        self.tokens: float | None = None
        self.ts: int | None = None
        self.calls = 0
        self.lock = asyncio.Lock()

    async def eval(self, script, numkeys, key, rate, burst, cost, now_ms, ttl_ms):
        async with self.lock:
            self.calls += 1
            rate_value = float(rate)
            burst_value = int(burst)
            cost_value = float(cost)
            now_value = int(now_ms)

            tokens = float(burst_value if self.tokens is None else self.tokens)
            ts = now_value if self.ts is None else self.ts
            elapsed = max(0, now_value - ts)
            tokens = min(float(burst_value), tokens + (elapsed * rate_value / 1000))

            if tokens >= cost_value:
                tokens -= cost_value
                allowed = 1
                wait_ms = 0
            else:
                allowed = 0
                wait_ms = int(((cost_value - tokens) * 1000 + rate_value - 1) // rate_value)

            self.tokens = tokens
            self.ts = now_value
            return [allowed, wait_ms]


def _config(**overrides) -> BrregEgressGuardConfig:
    values = {
        "enabled": True,
        "rate_per_second": 1.0,
        "burst": 2,
        "wait_timeout_seconds": 0.0,
        "redis_timeout_seconds": 1.0,
    }
    values.update(overrides)
    return BrregEgressGuardConfig(**values)


def test_load_config_exports_low_cardinality_config_gauge(monkeypatch):
    monkeypatch.setenv("BRREG_EGRESS_GUARD_ENABLED", "true")
    monkeypatch.setenv("BRREG_EGRESS_RATE_PER_SECOND", "12.5")
    monkeypatch.setenv("BRREG_EGRESS_BURST", "25")
    monkeypatch.setenv("BRREG_EGRESS_WAIT_TIMEOUT_SECONDS", "0.75")

    with patch("services.brreg_egress_guard.BRREG_EGRESS_CONFIG") as metric:
        config = load_brreg_egress_guard_config()

    assert config.rate_per_second == 12.5
    assert config.burst == 25
    labels = metric.labels
    labels.assert_any_call(setting="enabled")
    labels.assert_any_call(setting="rate_per_second")
    labels.assert_any_call(setting="burst")
    labels.assert_any_call(setting="wait_timeout_seconds")


@pytest.mark.parametrize(
    ("name", "value", "message"),
    [
        ("BRREG_EGRESS_RATE_PER_SECOND", "0", "RATE_PER_SECOND"),
        ("BRREG_EGRESS_RATE_PER_SECOND", "nan", "RATE_PER_SECOND"),
        ("BRREG_EGRESS_BURST", "0", "BURST"),
        ("BRREG_EGRESS_WAIT_TIMEOUT_SECONDS", "nan", "WAIT_TIMEOUT"),
        ("BRREG_EGRESS_REDIS_TIMEOUT_SECONDS", "0", "REDIS_TIMEOUT"),
    ],
)
def test_invalid_enabled_guard_config_fails_validation(monkeypatch, name, value, message):
    monkeypatch.setenv("BRREG_EGRESS_GUARD_ENABLED", "true")
    monkeypatch.setenv("BRREG_EGRESS_RATE_PER_SECOND", "5")
    monkeypatch.setenv("BRREG_EGRESS_BURST", "10")
    monkeypatch.setenv(name, value)

    with pytest.raises(ValueError, match=message):
        load_brreg_egress_guard_config()


class _GuardedBrregService(BaseExternalService):
    SERVICE_NAME = "Brønnøysund"
    BASE_URL = "https://data.brreg.no/enhetsregisteret/api"

    async def get_company(self):
        return await self._get(f"{self.BASE_URL}/enheter/123456789", context="company 123456789")


@pytest.mark.asyncio
async def test_disabled_guard_allows_without_redis():
    with patch("services.brreg_egress_guard.get_redis", side_effect=AssertionError("redis should not be used")):
        await acquire_brreg_egress_capacity(
            endpoint="company",
            traffic_class="public",
            config=_config(enabled=False, rate_per_second=None, burst=None),
        )


@pytest.mark.asyncio
async def test_missing_rate_or_burst_fails_closed():
    with pytest.raises(BrregEgressGuardError, match="not configured"):
        await acquire_brreg_egress_capacity(
            endpoint="company",
            traffic_class="public",
            config=_config(rate_per_second=None, burst=None),
        )


@pytest.mark.asyncio
async def test_burst_is_enforced_atomically_for_concurrent_callers():
    fake_redis = FakeTokenBucketRedis()

    async def acquire():
        await acquire_brreg_egress_capacity(
            endpoint="roles",
            traffic_class="public",
            config=_config(rate_per_second=1.0, burst=3, wait_timeout_seconds=0.0),
        )

    with patch("services.brreg_egress_guard.get_redis", return_value=fake_redis):
        results = await asyncio.gather(*(acquire() for _ in range(10)), return_exceptions=True)

    allowed = [result for result in results if result is None]
    rejected = [result for result in results if isinstance(result, BrregEgressGuardError)]
    assert len(allowed) == 3
    assert len(rejected) == 7
    assert fake_redis.calls == 10


@pytest.mark.asyncio
async def test_waits_when_capacity_returns_before_deadline():
    fake_redis = AsyncMock()
    fake_redis.eval = AsyncMock(side_effect=[[0, 10], [1, 0]])

    with (
        patch("services.brreg_egress_guard.get_redis", return_value=fake_redis),
        patch("asyncio.sleep", new_callable=AsyncMock) as sleep,
    ):
        await acquire_brreg_egress_capacity(
            endpoint="subunits",
            traffic_class="background",
            config=_config(rate_per_second=100.0, burst=1, wait_timeout_seconds=1.0),
        )

    sleep.assert_awaited_once_with(0.01)
    assert fake_redis.eval.await_count == 2


@pytest.mark.asyncio
async def test_rejects_when_wait_exceeds_deadline():
    fake_redis = AsyncMock()
    fake_redis.eval = AsyncMock(return_value=[0, 500])

    with patch("services.brreg_egress_guard.get_redis", return_value=fake_redis):
        with pytest.raises(BrregEgressGuardError, match="capacity exhausted") as exc:
            await acquire_brreg_egress_capacity(
                endpoint="financials",
                traffic_class="background",
                config=_config(rate_per_second=1.0, burst=1, wait_timeout_seconds=0.1),
            )

    assert exc.value.retry_after_seconds == 0.5


@pytest.mark.asyncio
async def test_redis_timeout_fails_closed():
    fake_redis = AsyncMock()

    async def slow_eval(*args, **kwargs):
        await asyncio.sleep(1)

    fake_redis.eval = slow_eval

    with patch("services.brreg_egress_guard.get_redis", return_value=fake_redis):
        with pytest.raises(BrregEgressGuardError, match="Redis timeout"):
            await acquire_brreg_egress_capacity(
                endpoint="company",
                traffic_class="public",
                config=_config(redis_timeout_seconds=0.001),
            )


@pytest.mark.asyncio
async def test_redis_error_fails_closed():
    fake_redis = AsyncMock()
    fake_redis.eval = AsyncMock(side_effect=RedisError("down"))

    with patch("services.brreg_egress_guard.get_redis", return_value=fake_redis):
        with pytest.raises(BrregEgressGuardError, match="Redis unavailable"):
            await acquire_brreg_egress_capacity(
                endpoint="company",
                traffic_class="public",
                config=_config(),
            )


@pytest.mark.asyncio
async def test_base_external_service_consumes_guard_capacity_for_each_retry(monkeypatch):
    monkeypatch.setenv("BRREG_EGRESS_GUARD_ENABLED", "true")
    monkeypatch.setenv("BRREG_EGRESS_RATE_PER_SECOND", "100")
    monkeypatch.setenv("BRREG_EGRESS_BURST", "10")
    monkeypatch.setenv("BRREG_EGRESS_WAIT_TIMEOUT_SECONDS", "0")

    fake_redis = FakeTokenBucketRedis()
    client = AsyncMock(spec=httpx.AsyncClient)
    first_response = httpx.Response(500)
    second_response = httpx.Response(200, json={"ok": True})
    client.get.side_effect = [first_response, second_response]
    service = _GuardedBrregService(client=client)
    service.RETRY_DELAY = 0.0
    service.RETRY_ATTEMPTS = 2

    with patch("services.brreg_egress_guard.get_redis", return_value=fake_redis):
        response = await service.get_company()

    assert response.status_code == 200
    assert fake_redis.calls == 2
    assert client.get.await_count == 2


@pytest.mark.asyncio
async def test_base_external_service_guard_rejection_blocks_transport(monkeypatch):
    monkeypatch.setenv("BRREG_EGRESS_GUARD_ENABLED", "true")
    monkeypatch.setenv("BRREG_EGRESS_RATE_PER_SECOND", "1")
    monkeypatch.setenv("BRREG_EGRESS_BURST", "1")
    monkeypatch.setenv("BRREG_EGRESS_WAIT_TIMEOUT_SECONDS", "0")

    fake_redis = AsyncMock()
    fake_redis.eval = AsyncMock(return_value=[0, 1000])
    client = AsyncMock(spec=httpx.AsyncClient)
    service = _GuardedBrregService(client=client)

    with patch("services.brreg_egress_guard.get_redis", return_value=fake_redis):
        with pytest.raises(ExternalApiException) as exc:
            await service.get_company()

    assert exc.value.status_code == 503
    client.get.assert_not_awaited()


@pytest.mark.asyncio
async def test_circuit_open_is_counted_without_fake_http_attempt(monkeypatch):
    monkeypatch.setenv("BRREG_EGRESS_GUARD_ENABLED", "false")
    service = _GuardedBrregService(client=AsyncMock(spec=httpx.AsyncClient))
    _GuardedBrregService._circuit_open_until = time.monotonic() + 10
    try:
        with (
            patch("services.base_external_service.BRREG_CIRCUIT_OPEN_TOTAL") as circuit_metric,
            patch("services.base_external_service.BRREG_HTTP_ATTEMPTS_TOTAL") as attempt_metric,
        ):
            with pytest.raises(ExternalApiException, match="Circuit open"):
                await service.get_company()
        circuit_metric.labels.assert_called_once_with(endpoint="company", traffic_class="public")
        attempt_metric.labels.assert_not_called()
    finally:
        _GuardedBrregService._circuit_open_until = 0
        _GuardedBrregService._circuit_failure_count = 0
