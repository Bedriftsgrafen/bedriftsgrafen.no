"""
Rate limiter configuration.

Uses Redis if REDIS_HOST is set, otherwise falls back to in-memory storage.
Redis uses database 1 (separate from cache in database 0).
"""

import os

from slowapi import Limiter
from slowapi.util import get_remote_address

redis_host = os.getenv("REDIS_HOST")
redis_port = os.getenv("REDIS_PORT", "6379")
redis_password = os.getenv("REDIS_PASSWORD")

# Use Redis if configured, fallback to in-memory
if redis_host:
    if redis_password:
        storage_uri = f"redis://:{redis_password}@{redis_host}:{redis_port}/1"
    else:
        storage_uri = f"redis://{redis_host}:{redis_port}/1"
else:
    storage_uri = "memory://"

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200/minute"],
    storage_uri=storage_uri,
)
