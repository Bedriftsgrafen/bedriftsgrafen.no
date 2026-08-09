"""Isolated executable security harness for Brreg egress controls."""

from __future__ import annotations

import asyncio
import logging
import multiprocessing
import os
from typing import Any

import httpx
from redis.asyncio import Redis

from services.base_external_service import ExternalApiException
from services.brreg_api_service import BrregApiService
from services.brreg_egress_guard import (
    BrregEgressGuardConfig,
    BrregEgressGuardError,
    acquire_brreg_egress_capacity,
)
from services.subunit_refresh_lock import (
    SubunitRefreshLockConfig,
    maintain_subunit_refresh_lock,
    try_acquire_subunit_refresh_lock,
)
from utils.redis_client import close_redis, get_redis

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def _counter_value(counter: Any, **labels: str) -> float:
    return float(counter.labels(**labels)._value.get())


async def _worker_async(attempts: int) -> tuple[int, int]:
    allowed = rejected = 0
    config = BrregEgressGuardConfig(True, 0.1, 7, 0.0, 1.0)
    for _ in range(attempts):
        try:
            await acquire_brreg_egress_capacity(endpoint="company", traffic_class="public", config=config)
            allowed += 1
        except BrregEgressGuardError:
            rejected += 1
    await close_redis()
    return allowed, rejected


def _worker(attempts: int, queue: multiprocessing.Queue) -> None:
    queue.put(asyncio.run(_worker_async(attempts)))


async def verify_multi_process_global_bucket() -> None:
    redis = get_redis()
    await redis.delete("brreg:egress:global")
    context = multiprocessing.get_context("spawn")
    queue = context.Queue()
    processes = [context.Process(target=_worker, args=(10, queue)) for _ in range(4)]
    for process in processes:
        process.start()
    results = [queue.get(timeout=20) for _ in processes]
    for process in processes:
        process.join(timeout=20)
        assert process.exitcode == 0
    allowed = sum(item[0] for item in results)
    rejected = sum(item[1] for item in results)
    assert allowed == 7, (allowed, rejected)
    assert rejected == 33, (allowed, rejected)
    logger.info("PASS shared Redis bucket: allowed=%d, rejected=%d, processes=4", allowed, rejected)


async def verify_fail_closed_when_redis_is_unavailable() -> None:
    from services import brreg_egress_guard

    unavailable = Redis(host="127.0.0.1", port=1, socket_connect_timeout=0.05, decode_responses=True)
    original = brreg_egress_guard.get_redis
    brreg_egress_guard.get_redis = lambda: unavailable
    config = BrregEgressGuardConfig(True, 5.0, 5, 0.0, 0.1)
    try:
        try:
            await acquire_brreg_egress_capacity(endpoint="company", traffic_class="public", config=config)
        except BrregEgressGuardError:
            logger.info("PASS Redis outage: outbound capacity failed closed")
        else:
            raise AssertionError("Redis outage unexpectedly allowed egress")
    finally:
        brreg_egress_guard.get_redis = original
        await unavailable.aclose()


async def verify_lock_lease_renewal() -> None:
    config = SubunitRefreshLockConfig(1, 0.5, 0.01, 0.5)
    lock = await try_acquire_subunit_refresh_lock("123456789", config=config)
    assert lock is not None
    async with maintain_subunit_refresh_lock(lock, config=config):
        await asyncio.sleep(1.4)
        assert await try_acquire_subunit_refresh_lock("123456789", config=config) is None
    replacement = await try_acquire_subunit_refresh_lock("123456789", config=config)
    assert replacement is not None
    logger.info("PASS single-flight lease: ownership renewed beyond initial TTL and released")


async def verify_pagination_and_retry_semantics() -> None:
    from utils.metrics import BRREG_HTTP_ATTEMPTS_TOTAL, BRREG_LOGICAL_OPERATIONS_TOTAL

    os.environ["BRREG_EGRESS_GUARD_ENABLED"] = "false"
    pages = 0

    def paginated(request: httpx.Request) -> httpx.Response:
        nonlocal pages
        pages += 1
        body: dict[str, Any] = {"_embedded": {"underenheter": []}, "_links": {}}
        if pages < 3:
            body["_links"] = {"next": {"href": f"https://stub.invalid/page/{pages + 1}"}}
        return httpx.Response(200, json=body)

    labels = {"endpoint": "subunits", "traffic_class": "public"}
    before_logical = _counter_value(BRREG_LOGICAL_OPERATIONS_TOTAL, **labels)
    before_attempts = _counter_value(BRREG_HTTP_ATTEMPTS_TOTAL, **labels, status_category="2xx")
    async with httpx.AsyncClient(transport=httpx.MockTransport(paginated)) as client:
        await BrregApiService(client=client).fetch_subunits("123456789")
    assert _counter_value(BRREG_LOGICAL_OPERATIONS_TOTAL, **labels) - before_logical == 1
    assert _counter_value(BRREG_HTTP_ATTEMPTS_TOTAL, **labels, status_category="2xx") - before_attempts == 3

    failures = 0

    def failing(request: httpx.Request) -> httpx.Response:
        nonlocal failures
        failures += 1
        return httpx.Response(500)

    BrregApiService._circuit_failure_count = 0
    BrregApiService._circuit_open_until = 0
    before_logical = _counter_value(BRREG_LOGICAL_OPERATIONS_TOTAL, endpoint="company", traffic_class="public")
    before_attempts = _counter_value(
        BRREG_HTTP_ATTEMPTS_TOTAL,
        endpoint="company",
        traffic_class="public",
        status_category="5xx",
    )
    async with httpx.AsyncClient(transport=httpx.MockTransport(failing)) as client:
        service = BrregApiService(client=client)
        service.RETRY_DELAY = 0
        try:
            await service.fetch_company("123456789")
        except ExternalApiException:
            pass
        else:
            raise AssertionError("three upstream 500 responses unexpectedly succeeded")
    assert failures == 3
    assert (
        _counter_value(BRREG_LOGICAL_OPERATIONS_TOTAL, endpoint="company", traffic_class="public") - before_logical == 1
    )
    assert (
        _counter_value(
            BRREG_HTTP_ATTEMPTS_TOTAL,
            endpoint="company",
            traffic_class="public",
            status_category="5xx",
        )
        - before_attempts
        == 3
    )
    logger.info("PASS metrics: one logical operation, every page/retry counted as an HTTP attempt")


async def main() -> None:
    await verify_multi_process_global_bucket()
    await verify_fail_closed_when_redis_is_unavailable()
    await verify_lock_lease_renewal()
    await verify_pagination_and_retry_semantics()
    logger.info("BRREG SECURITY HARNESS PASSED")


if __name__ == "__main__":
    asyncio.run(main())
