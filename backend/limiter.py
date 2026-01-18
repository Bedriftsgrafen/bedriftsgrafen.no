from slowapi import Limiter
from slowapi.util import get_remote_address

# Initialize rate limiter with get_remote_address as key function
# This is in a separate file to avoid circular imports with main.py
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
