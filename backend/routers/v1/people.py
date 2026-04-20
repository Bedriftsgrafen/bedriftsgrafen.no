"""Router for Person Search and Role History.

Implements legally compliant person-role mapping per Enhetsregisterloven § 22.
Only commercial roles (næringsvirksomhet) are returned.
"""

import logging
import re
from datetime import date

from fastapi import APIRouter, Depends, Header, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from repositories.role_repository import RoleRepository
from schemas.people import (
    CompanySparklineData,
    NetworkPathRequest,
    NetworkPathResponse,
    PaginatedPersonSearch,
    PersonAggregateStats,
    PersonConnectionResponse,
    PersonRoleResponse,
    PersonSearchResult,
    PersonSearchResultDetailed,
    PersonToplistResponse,
)
from services.person_service import PersonService, get_person_service
from utils.auth import is_admin

logger = logging.getLogger(__name__)

router: APIRouter = APIRouter(prefix="/v1/people", tags=["people"])


def _parse_birthdate(birthdate: str | None) -> tuple[date | None, int | None]:
    """Parse birthdate param: year-only, full ISO date, or None.

    Returns:
        Tuple of (parsed_date, parsed_year). At most one is non-None.
    """
    if not birthdate or birthdate in ("unknown", "none"):
        return None, None
    if re.fullmatch(r"\d{4}", birthdate):
        return None, int(birthdate)
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", birthdate):
        return date.fromisoformat(birthdate), None
    return None, None


@router.get("/search", response_model=list[PersonSearchResult])
async def search_people(
    request: Request,
    q: str = Query(..., min_length=3, description="Search query (min 3 characters)"),
    limit: int = Query(10, ge=1, le=50, description="Maximum results to return"),
    x_admin_key: str | None = Header(None, alias="X-Admin-Key"),
    db: AsyncSession = Depends(get_db),
) -> list[PersonSearchResult]:
    """
    Search for people across all company roles.

    Returns unique people identified by name + birthdate combination,
    sorted by the number of roles held (most active first).
    """
    role_repo = RoleRepository(db)
    results = await role_repo.search_people(q, limit=limit, include_all=is_admin(x_admin_key))
    return [PersonSearchResult(**r) for r in results]


@router.get("/search/results", response_model=PaginatedPersonSearch)
async def search_people_results(
    request: Request,
    q: str = Query(..., min_length=3, description="Search query (min 3 characters)"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    limit: int = Query(20, ge=1, le=100, description="Results per page"),
    sort_by: str = Query("role_count", description="Sort field", pattern="^(role_count|active_roles|name)$"),
    sort_order: str = Query("desc", description="Sort order", pattern="^(asc|desc)$"),
    x_admin_key: str | None = Header(None, alias="X-Admin-Key"),
    db: AsyncSession = Depends(get_db),
) -> PaginatedPersonSearch:
    """
    Paginated, enriched person search for the results page.

    Returns detailed person results including active/total role counts,
    top role types, and notable company names.
    """
    role_repo = RoleRepository(db)
    admin = is_admin(x_admin_key)

    results = await role_repo.search_people_detailed(
        q, offset=offset, limit=limit, include_all=admin, sort_by=sort_by, sort_order=sort_order
    )
    total_count = await role_repo.count_people_search(q, include_all=admin)

    return PaginatedPersonSearch(
        results=[PersonSearchResultDetailed(**r) for r in results],
        total_count=total_count,
        query=q,
    )


@router.get("/roles", response_model=list[PersonRoleResponse])
async def get_person_roles(
    request: Request,
    name: str = Query(..., description="Person's full name"),
    birthdate: str | None = Query(None, description="Birth date or year for disambiguation"),
    x_admin_key: str | None = Header(None, alias="X-Admin-Key"),
    service: PersonService = Depends(get_person_service),
) -> list[PersonRoleResponse]:
    """
    Fetch all LEGALLY ALLOWED roles for a person, enriched with company context and financials.

    Only includes commercial entities (næringsvirksomhet) as per Enhetsregisterloven § 22.
    Roles in voluntary organizations, housing cooperatives, and other non-commercial
    entities are excluded to comply with Norwegian privacy regulations.

    The birthdate param accepts:
      - "1996"         → year-only lookup (EXTRACT)
      - "1996-03-12"   → exact date match
      - None / omitted → no birthdate filter
    """
    parsed_date, parsed_year = _parse_birthdate(birthdate)
    return await service.get_enriched_roles(name, parsed_date, parsed_year, is_admin(x_admin_key))


@router.get("/connections", response_model=list[PersonConnectionResponse])
async def get_person_connections(
    request: Request,
    name: str = Query(..., description="Person's full name"),
    birthdate: str | None = Query(None, description="Birth date or year for disambiguation"),
    limit: int = Query(25, ge=1, le=100, description="Max connections to return"),
    x_admin_key: str | None = Header(None, alias="X-Admin-Key"),
    service: PersonService = Depends(get_person_service),
) -> list[PersonConnectionResponse]:
    """
    Find people connected via shared board/role memberships.

    Returns people who share active roles at the same companies,
    sorted by shared company count (most overlap first).
    GDPR: Only birth year is exposed for connected persons.
    """
    parsed_date, parsed_year = _parse_birthdate(birthdate)
    return await service.get_connections(name, parsed_date, parsed_year, is_admin(x_admin_key), limit=limit)


@router.get("/sparklines", response_model=list[CompanySparklineData])
async def get_person_sparklines(
    request: Request,
    name: str = Query(..., description="Person's full name"),
    birthdate: str | None = Query(None, description="Birth date or year for disambiguation"),
    years: int = Query(5, ge=3, le=10, description="Number of years of data"),
    x_admin_key: str | None = Header(None, alias="X-Admin-Key"),
    service: PersonService = Depends(get_person_service),
) -> list[CompanySparklineData]:
    """
    Mini revenue + profit sparklines for all companies a person is connected to.

    Returns time-series data for the last N years per company, suitable for
    inline sparkline chart rendering.
    """
    parsed_date, parsed_year = _parse_birthdate(birthdate)
    return await service.get_role_sparklines(name, parsed_date, parsed_year, is_admin(x_admin_key), years=years)


@router.post("/network-path", response_model=NetworkPathResponse)
async def find_network_path(
    request: Request,
    body: NetworkPathRequest,
    x_admin_key: str | None = Header(None, alias="X-Admin-Key"),
    service: PersonService = Depends(get_person_service),
) -> NetworkPathResponse:
    """
    Find shortest path between two people via shared board seats.

    BFS traversal: Person A → Companies → People → Companies → ... → Person B.
    Returns the path as alternating person/company nodes.
    """
    a_date, a_year = _parse_birthdate(body.person_a_birthdate)
    b_date, b_year = _parse_birthdate(body.person_b_birthdate)
    return await service.find_network_path(
        (body.person_a_name, a_date, a_year),
        (body.person_b_name, b_date, b_year),
        max_depth=body.max_depth,
        include_all=is_admin(x_admin_key),
    )


@router.get("/toplists", response_model=list[PersonToplistResponse])
async def get_person_toplists(
    limit: int = Query(10, ge=1, le=50, description="Entries per category"),
    service: PersonService = Depends(get_person_service),
) -> list[PersonToplistResponse]:
    """All toplist categories in one response (~60 rows)."""
    return await service.get_all_toplists(limit)


@router.get("/stats", response_model=PersonAggregateStats)
async def get_person_stats(
    service: PersonService = Depends(get_person_service),
) -> PersonAggregateStats:
    """Aggregate statistics across all persons in commercial entities."""
    return await service.get_stats()
