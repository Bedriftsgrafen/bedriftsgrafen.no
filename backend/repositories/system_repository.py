import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class SystemRepository:
    """
    Repository for managing system state and configuration.
    Handles interaction with the 'system_state' table.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def ensure_state_table(self):
        """Ensure system_state table exists"""
        try:
            await self.db.execute(
                text("""
                CREATE TABLE IF NOT EXISTS system_state (
                    key VARCHAR(50) PRIMARY KEY,
                    value VARCHAR(255),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            """)
            )
            await self.db.commit()
        except Exception as e:
            logger.error(f"Failed to ensure system_state table: {e}")
            await self.db.rollback()

    async def get_state(self, key: str) -> str | None:
        """Get value from system_state"""
        try:
            result = await self.db.execute(text("SELECT value FROM system_state WHERE key = :key"), {"key": key})
            row = result.fetchone()
            return row[0] if row else None
        except Exception as e:
            logger.warning(f"Failed to read state for {key}: {e}")
            return None

    async def set_state(self, key: str, value: str):
        """Set value in system_state"""
        try:
            await self.db.execute(
                text("""
                INSERT INTO system_state (key, value, updated_at)
                VALUES (:key, :value, NOW())
                ON CONFLICT (key) DO UPDATE
                SET value = EXCLUDED.value, updated_at = NOW()
            """),
                {"key": key, "value": value},
            )
            await self.db.commit()
        except Exception as e:
            logger.warning(f"Failed to save state for {key}: {e}")
            await self.db.rollback()
