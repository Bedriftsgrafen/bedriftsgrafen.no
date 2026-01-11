import logging
import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

logger = logging.getLogger(__name__)

# Database connection parameters (with defaults for CI/testing)
DB_USER = os.getenv("DATABASE_USER", "test")
DB_PASSWORD = os.getenv("DATABASE_PASSWORD", "test")
DB_HOST = os.getenv("DATABASE_HOST", "localhost")
DB_PORT = os.getenv("DATABASE_PORT", "5432")
DB_NAME = os.getenv("DATABASE_NAME", "test")

SQLALCHEMY_DATABASE_URL = f"postgresql+asyncpg://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

# Environment-based connection pool configuration
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
IS_PRODUCTION = ENVIRONMENT == "production"
IS_TESTING = os.getenv("TESTING", "false").lower() == "true"

# Connection pool settings (tuned for low-resource environments)
POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "10" if IS_PRODUCTION else "5"))
MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "5" if IS_PRODUCTION else "0"))
POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))
POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "3600"))  # 1 hour
STATEMENT_TIMEOUT = int(os.getenv("DB_STATEMENT_TIMEOUT", "30000"))  # 30s in milliseconds

if not IS_TESTING:
    logger.info(
        f"Database pool configuration: pool_size={POOL_SIZE}, max_overflow={MAX_OVERFLOW}, "
        f"pool_timeout={POOL_TIMEOUT}s, pool_recycle={POOL_RECYCLE}s"
    )

# Create async engine with tuned pool settings
# pool_pre_ping: Test connections before use (detects stale connections)
# pool_recycle: Recycle connections after 1 hour (closes PostgreSQL idle connections)
# server_settings: Apply per-connection statement timeout for safety
engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL,
    echo=False,
    pool_size=POOL_SIZE,
    max_overflow=MAX_OVERFLOW,
    pool_timeout=POOL_TIMEOUT,
    pool_pre_ping=True,
    pool_recycle=POOL_RECYCLE,
    connect_args={"server_settings": {"statement_timeout": str(STATEMENT_TIMEOUT)}},
)

AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
