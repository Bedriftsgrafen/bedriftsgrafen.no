"""Unit tests for database.get_db() session dependency."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.mark.asyncio
async def test_get_db_yields_session():
    """get_db() yields an AsyncSession to the caller."""
    mock_session = AsyncMock()
    mock_ctx_manager = MagicMock()
    mock_ctx_manager.__aenter__ = AsyncMock(return_value=mock_session)
    mock_ctx_manager.__aexit__ = AsyncMock(return_value=False)

    with patch("database.AsyncSessionLocal", return_value=mock_ctx_manager):
        from database import get_db

        gen = get_db()
        session = await gen.__anext__()
        assert session is mock_session

        # Clean close — no rollback expected
        with pytest.raises(StopAsyncIteration):
            await gen.__anext__()

        mock_session.rollback.assert_not_called()


@pytest.mark.asyncio
async def test_get_db_rolls_back_on_exception():
    """get_db() calls rollback() when the endpoint raises and re-raises the exception."""
    mock_session = AsyncMock()
    mock_ctx_manager = MagicMock()
    mock_ctx_manager.__aenter__ = AsyncMock(return_value=mock_session)
    mock_ctx_manager.__aexit__ = AsyncMock(return_value=False)

    with patch("database.AsyncSessionLocal", return_value=mock_ctx_manager):
        from database import get_db

        gen = get_db()
        await gen.__anext__()

        with pytest.raises(RuntimeError, match="simulated endpoint error"):
            await gen.athrow(RuntimeError("simulated endpoint error"))

        mock_session.rollback.assert_awaited_once()
