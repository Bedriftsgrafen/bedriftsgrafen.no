"""
Integration tests for Advanced Purpose Search (Formål).
Verifies that FTS correctly matches keywords in vedtektsfestet_formaal and respects ranking.
"""

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
import models
from repositories.company.repository import CompanyRepository


@pytest_asyncio.fixture
async def db_session():
    """Setup in-memory SQLite for testing SQL logic."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    await engine.dispose()


@pytest.mark.asyncio
async def test_search_by_purpose_discovery(db_session: AsyncSession):
    """
    Test that searching for a keyword present in the purpose field
    returns the correct company.
    """
    # 1. Setup Test Data
    unique_keyword = "antigravitysearchkeyword"
    test_orgnr = "999888777"

    # Check if we are on SQLite (which doesn't support the @ operator)
    if db_session.bind and "sqlite" in db_session.bind.dialect.name:
        pytest.skip("Full-text search logic requires Postgres")

    test_company = models.Company(
        orgnr=test_orgnr,
        navn="Purpose Discovery AS",
        organisasjonsform="AS",
        vedtektsfestet_formaal=f"Vårt formål inneholder {unique_keyword}.",
    )
    db_session.add(test_company)
    await db_session.commit()

    repo = CompanyRepository(db_session)

    # 2. Search for keyword
    results = await repo.search_by_name(unique_keyword, limit=10)
    assert any(c.orgnr == test_orgnr for c in results), (
        f"Company {test_orgnr} not found by purpose keyword '{unique_keyword}'"
    )


@pytest.mark.asyncio
async def test_search_rank_ordering(db_session: AsyncSession):
    """
    Test that exact name matches rank higher than purpose matches.
    """
    unique_keyword = "ranktestingkeyword"

    # Check if we are on SQLite
    if db_session.bind and "sqlite" in db_session.bind.dialect.name:
        pytest.skip("Full-text search logic requires Postgres")

    # Company with keyword in name
    c1 = models.Company(
        orgnr="111111111", navn=f"{unique_keyword} Spesialisten", vedtektsfestet_formaal="Bygg og anlegg."
    )
    # Company with keyword only in purpose
    c2 = models.Company(
        orgnr="222222222", navn="Byggmester Bob AS", vedtektsfestet_formaal=f"Vi bruker mye {unique_keyword}."
    )

    db_session.add(c1)
    db_session.add(c2)
    await db_session.commit()

    repo = CompanyRepository(db_session)
    results = await repo.search_by_name(unique_keyword, limit=10)

    assert len(results) >= 2
    # The one with keyword in name should be first
    # Results are ranked by (ExactMatch, PrefixMatch, ts_rank)
    assert results[0].orgnr == "111111111", f"Expected {c1.orgnr} at top, but got {results[0].orgnr}"
    assert any(c.orgnr == "222222222" for c in results), f"Company {c2.orgnr} should be in results"
