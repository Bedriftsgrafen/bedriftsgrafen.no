from aiolimiter import AsyncLimiter

# Global Brreg rate limit to prevent 429 errors (5 requests per second)
BRREG_RATE_LIMITER = AsyncLimiter(5, 1)
