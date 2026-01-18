"""
MECE SQL Statement Verification for RoleRepository.
Verifies that the repository generates correct SQL clauses for legal compliance.
"""

import pytest
from repositories.role_repository import RoleRepository
from unittest.mock import MagicMock, AsyncMock


@pytest.fixture
def repo():
    return RoleRepository(AsyncMock())


def test_get_person_commercial_roles_public_sql(repo):
    """
    MECE: include_all=False MUST include Enhetsregisterloven § 22 filtering.
    """
    captured_stmt = None

    async def mock_execute(stmt):
        nonlocal captured_stmt
        captured_stmt = stmt
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        return mock_result

    repo.db.execute = mock_execute

    # Act
    import asyncio

    asyncio.run(repo.get_person_commercial_roles("Ola Nordmann", include_all=False))

    # Assert
    sql_str = str(captured_stmt.compile(compile_kwargs={"literal_binds": True})).lower()
    where_clause = sql_str.split("where")[-1]

    # Public view should have the complex commercial filter in the WHERE clause
    assert "registrert_i_foretaksregisteret" in where_clause
    assert "brl" in where_clause
    assert "not in" in where_clause or "!= 'brl'" in where_clause or "not" in where_clause


def test_get_person_commercial_roles_admin_sql(repo):
    """
    MECE: include_all=True MUST bypass commercial filtering.
    """
    captured_stmt = None

    async def mock_execute(stmt):
        nonlocal captured_stmt
        captured_stmt = stmt
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        return mock_result

    repo.db.execute = mock_execute

    # Act
    import asyncio

    asyncio.run(repo.get_person_commercial_roles("Ola Nordmann", include_all=True))

    # Assert
    sql_str = str(captured_stmt.compile(compile_kwargs={"literal_binds": True})).lower()
    where_clause = sql_str.split("where")[-1]

    # Admin view should NOT have the commercial filter in the WHERE clause
    assert "registrert_i_foretaksregisteret" not in where_clause
    assert "brl" not in where_clause


def test_search_people_admin_vs_public_sql(repo):
    """
    MECE: search_people must also apply consistent filtering.
    """
    # 1. Capture Public Search
    public_stmt = None

    async def mock_exec_public(stmt):
        nonlocal public_stmt
        public_stmt = stmt
        mock_result = MagicMock()
        return mock_result

    repo.db.execute = mock_exec_public
    import asyncio

    asyncio.run(repo.search_people("Ola", include_all=False))

    # 2. Capture Admin Search
    admin_stmt = None

    async def mock_exec_admin(stmt):
        nonlocal admin_stmt
        admin_stmt = stmt
        mock_result = MagicMock()
        return mock_result

    repo.db.execute = mock_exec_admin
    asyncio.run(repo.search_people("Ola", include_all=True))

    public_sql = str(public_stmt.compile(compile_kwargs={"literal_binds": True})).lower()
    admin_sql = str(admin_stmt.compile(compile_kwargs={"literal_binds": True})).lower()

    public_where = public_sql.split("where")[-1]
    admin_where = admin_sql.split("where")[-1]

    assert "registrert_i_foretaksregisteret" in public_where
    assert "registrert_i_foretaksregisteret" not in admin_where
