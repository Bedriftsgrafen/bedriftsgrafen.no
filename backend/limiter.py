"""
Rate limiter configuration.

Uses Redis if REDIS_HOST is set, otherwise falls back to in-memory storage.
Redis uses database 1 (separate from cache in database 0).
"""

import os
from typing import Any

from slowapi import Limiter
from slowapi.util import get_remote_address

from utils.redis_client import load_redis_socket_timeouts

redis_host = os.getenv("REDIS_HOST")
redis_port = os.getenv("REDIS_PORT", "6379")
redis_password = os.getenv("REDIS_PASSWORD")
storage_options: dict[str, Any] = {}

# Use Redis if configured, fallback to in-memory
if redis_host:
    if redis_password:
        storage_uri = f"redis://:{redis_password}@{redis_host}:{redis_port}/1"
    else:
        storage_uri = f"redis://{redis_host}:{redis_port}/1"
    socket_connect_timeout, socket_timeout = load_redis_socket_timeouts()
    storage_options = {
        "socket_connect_timeout": socket_connect_timeout,
        "socket_timeout": socket_timeout,
    }
else:
    storage_uri = "memory://"

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200/minute"],
    storage_uri=storage_uri,
    storage_options=storage_options,
    # Bucket per (client, route) instead of per (client, exact URL).
    #
    # slowapi defaults to key_style="url", which puts the concrete request path
    # in the bucket key. Every endpoint with a path parameter is then trivially
    # bypassable: varying the parameter yields a fresh bucket per request, so no
    # limit is ever reached. A scraper used this on 2026-08-04 to pull 167k
    # /v1/companies/{orgnr}/roles responses at up to 15 req/s without a single
    # 429, because each orgnr had its own bucket.
    #
    # "endpoint" keys on the view function instead, so all orgnrs share one
    # bucket per client. Do not change this back.
    key_style="endpoint",
)
