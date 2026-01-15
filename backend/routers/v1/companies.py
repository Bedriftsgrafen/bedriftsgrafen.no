import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from dependencies.company_filters import CompanyQueryParams
from exceptions import BrregApiException
from main import limiter
from repositories.accounting_repository import AccountingRepository
from schemas.companies import (
    AccountingWithKpis,
    CompanyBase,
    CompanyWithAccounting,
    FetchCompanyRequest,
    FetchCompanyResponse,
    IndustryCompaniesResponse,
    NaceSubclass,
    Naeringskode,
)
from services.company_service import CompanyService
from services.export_service import ExportService
from services.kpi_service import KpiService
from services.nace_service import NaceService
from services.response_models import (
    RoleResponse,
    RolesWithMetadata,
    SubUnitResponse,
    SubUnitsWithMetadata,
)
from services.role_service import RoleService
from utils.caching import set_subunit_detail_cache, set_subunit_search_cache
from utils.response_builders import build_response_metadata

router: APIRouter = APIRouter(prefix="/v1/companies", tags=["companies-v1"])


@router.get("", response_model=list[CompanyBase])
@limiter.limit("5/second")
async def get_companies(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    sort_by: str = Query(
        "navn", description="Field to sort by (navn, antall_ansatte, stiftelsesdato, revenue, profit, operating_profit)"
    ),
    sort_order: str = Query("asc", description="Sort order (asc, desc)"),
    params: CompanyQueryParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Get companies with filters

    Uses CompanyFilterDTO for type-safe parameter handling.
    """
    # Build DTO from query parameters dependency
    filters = params.to_dto(skip=skip, limit=limit, sort_by=sort_by, sort_order=sort_order)

    service = CompanyService(db)
    return await service.get_companies(filters)


@router.get("/count", response_model=int)
@limiter.limit("10/second")
async def count_companies(
    request: Request,
    sort_by: str = Query("navn", description="Sort field (affects count when financial sort)"),
    params: CompanyQueryParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Count companies matching filters. No pagination parameters."""
    # Build filter DTO (no pagination params for counting, but include sort_by)
    filters = params.to_dto(sort_by=sort_by)

    service = CompanyService(db)
    return await service.count_companies(filters=filters)


@router.get("/stats")
@limiter.limit("10/second")
async def get_company_stats(
    request: Request,
    sort_by: str = Query("navn", description="Sort field (affects stats when financial sort)"),
    params: CompanyQueryParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """
    Get aggregate statistics for companies matching filters.
    Returns total count, sum of revenue/profit/employees, and organisation form breakdown.
    """
    # Build filter DTO (include sort_by as it affects join behavior)
    filters = params.to_dto(sort_by=sort_by)

    service = CompanyService(db)
    return await service.get_aggregate_stats(filters=filters)


@router.get("/export")
@limiter.limit("5/minute")
async def export_companies(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    sort_by: str = Query("navn", description="Field to sort by"),
    sort_order: str = Query("asc", description="Sort order"),
    params: CompanyQueryParams = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """
    Export filtered companies as CSV.
    Uses generator to stream large datasets without memory spikes.
    Returns downloadable CSV file with UTF-8 BOM for Excel compatibility.
    """
    try:
        # Build filters using DTO (override skip/limit for full export)
        # Use limit from service to ensure consistent constraints
        filters = params.to_dto(skip=0, limit=ExportService.EXPORT_ROW_LIMIT, sort_by=sort_by, sort_order=sort_order)

        export_service = ExportService(db)

        # Generate filename with timestamp
        filename = f"selskaper_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

        return StreamingResponse(
            export_service.stream_companies_csv(filters),
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Type": "text/csv; charset=utf-8",
            },
        )

    except Exception as e:
        logging.error(f"Export failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Export failed. Please try again later.")


@router.get("/search", response_model=list[CompanyBase])
@limiter.limit("10/second")
async def search_companies(request: Request, name: str, limit: int = 20, db: AsyncSession = Depends(get_db)):
    service = CompanyService(db)
    return await service.search_companies(name, limit)


@router.get("/search/subunits", response_model=SubUnitsWithMetadata)
@limiter.limit("10/second")
async def search_subunits(
    request: Request,
    q: str = Query(..., min_length=2, description="Search query (minimum 2 characters)"),
    limit: int = Query(50, ge=1, le=500, description="Maximum number of results"),
    db: AsyncSession = Depends(get_db),
    response: Response = None,  # type: ignore[assignment]
):
    """
    Fuzzy search for subunits by name.

    Uses PostgreSQL trigram similarity with a 0.3 threshold for fuzzy matching.
    Results are sorted by similarity (best matches first).
    Note: First search may take 1-2 seconds due to large dataset scanning.

    Query must be at least 2 characters.

    Example:
        GET /v1/companies/search/subunits?q=rema&limit=20
    """
    service = CompanyService(db)
    subunits = await service.search_subunits(q, limit)
    result = [SubUnitResponse.model_validate(s) for s in subunits]

    # Set HTTP caching headers for search results
    if response:
        set_subunit_search_cache(response, q, limit, len(result))

    return SubUnitsWithMetadata(data=result, total=len(result), metadata=build_response_metadata())


@router.get("/nace/{prefix}/subclasses", response_model=list[NaceSubclass])
@limiter.limit("10/second")
async def get_nace_subclasses(
    request: Request,
    prefix: str = Path(..., description="NACE code prefix (e.g. '01')"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get NACE subclasses for a given prefix.
    """
    service = NaceService(db)
    return await service.get_subclasses(prefix)


@router.get("/nace/hierarchy", response_model=list[dict])
@limiter.limit("5/second")
async def get_nace_hierarchy(request: Request):
    """
    Get full NACE hierarchy from SSB with all levels.
    """
    return await NaceService.get_hierarchy()


@router.get("/industry/{nace_code}", response_model=IndustryCompaniesResponse)
@limiter.limit("10/second")
async def get_companies_by_industry(
    request: Request,
    nace_code: str = Path(
        ...,
        min_length=1,
        max_length=12,
        pattern=r"^[\d.]+$",
        description="NACE industry code (e.g., '62.010' or '62' for prefix match)",
    ),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(20, ge=1, le=100, description="Items per page"),
    include_inactive: bool = Query(False, description="Include bankrupt/liquidating companies"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all companies in a specific industry (NACE code).
    """
    service = CompanyService(db)
    return await service.get_companies_by_industry(nace_code, page, limit, include_inactive)


# =============================================================================
# Map Markers Endpoint (MUST be before /{orgnr} route to avoid path conflict)
# =============================================================================


class MapMarker(BaseModel):
    """Minimal marker data for map display."""

    orgnr: str
    navn: str
    lat: float
    lng: float
    nace: str | None = None
    ansatte: int | None = None

    model_config = ConfigDict(from_attributes=True)


class MarkersResponse(BaseModel):
    """Response for markers with count."""

    markers: list[MapMarker]
    total: int
    truncated: bool = False  # True if more markers exist than returned


@router.get("/markers", response_model=MarkersResponse)
@limiter.limit("10/second")
async def get_company_markers(
    request: Request,
    naeringskode: str = Query(
        ...,
        min_length=1,
        max_length=12,
        pattern=r"^[\d.]+$",
        description="NACE code filter (required, e.g. '68' or '68.100')",
    ),
    bbox: str | None = Query(None, description="Bounding box: west,south,east,north"),
    county: str | None = Query(None, description="2-digit county code filter"),
    municipality: str | None = Query(None, description="Municipality name filter"),
    limit: int = Query(5000, le=10000, description="Max markers to return"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get company markers for map display.

    Returns minimal data (orgnr, name, lat/lng) for companies with coordinates.
    Requires a NACE code filter and optionally a bounding box or region filter.

    Performance optimized for large datasets with clustering on frontend.
    """
    from repositories.company import CompanyRepository

    # Parse bounding box if provided
    parsed_bbox = None
    if bbox:
        try:
            west, south, east, north = map(float, bbox.split(","))
            parsed_bbox = (west, south, east, north)
        except (ValueError, TypeError):
            raise HTTPException(400, "Invalid bbox format. Use: west,south,east,north")

    # Use repository for query
    repo = CompanyRepository(db)
    rows, total = await repo.get_map_markers(
        naeringskode=naeringskode,
        county=county,
        municipality=municipality,
        bbox=parsed_bbox,
        limit=limit,
    )

    # Build markers
    markers = [
        MapMarker(
            orgnr=row[0],
            navn=row[1] or "",
            lat=row[2],
            lng=row[3],
            nace=row[4],
            ansatte=row[5],
        )
        for row in rows
    ]

    return MarkersResponse(markers=markers, total=total, truncated=total > limit)


@router.get("/{orgnr}", response_model=CompanyWithAccounting)
@limiter.limit("10/second")
async def get_company(request: Request, orgnr: str, db: AsyncSession = Depends(get_db)):
    service = CompanyService(db)
    company = await service.get_company_with_accounting(orgnr)
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")

    # Auto-geocode if missing coordinates (legacy behavior preserved via Service)
    if company.latitude is None:
        await service.ensure_geocoded(company)

    # Enrich with NACE descriptions (batch fetch to avoid N+1 sequential awaits)
    response = CompanyWithAccounting.model_validate(company)
    codes = company.naeringskoder
    if codes:
        # Fetch all NACE names concurrently
        import asyncio

        descriptions = await asyncio.gather(*[NaceService.get_nace_name(c) for c in codes])
        response.naeringskoder = [Naeringskode(kode=c, beskrivelse=desc) for c, desc in zip(codes, descriptions)]
    else:
        response.naeringskoder = []

    return response


@router.get("/{orgnr}/similar", response_model=list[CompanyBase])
@limiter.limit("10/second")
async def get_similar_companies(
    request: Request,
    orgnr: str,
    limit: int = Query(5, ge=1, le=20, description="Number of similar companies to return"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get similar companies based on industry (naeringskode) and location (kommune).
    Prioritizes companies in the same municipality, then falls back to same industry.
    """
    service = CompanyService(db)
    similar = await service.get_similar_companies(orgnr, limit)

    # If empty list is returned, the source company either doesn't exist
    # or has no naeringskode. We return empty list rather than 404
    # since an empty result is valid (no similar companies found).
    return similar


@router.get("/{orgnr}/accounting/{year}", response_model=AccountingWithKpis)
@limiter.limit("10/second")
async def get_accounting_with_kpis(request: Request, orgnr: str, year: int, db: AsyncSession = Depends(get_db)):
    """
    Get accounting data for a specific year with calculated KPIs
    """
    repo = AccountingRepository(db)
    accounting = await repo.get_by_orgnr_and_year(orgnr, year)

    if accounting is None:
        raise HTTPException(status_code=404, detail="Accounting data not found")

    # Calculate KPIs
    kpis = KpiService.calculate_all_kpis(accounting)

    # Convert to response model
    response = AccountingWithKpis.model_validate(accounting)
    response.kpis = kpis

    return response


@router.post("/{orgnr}/fetch", response_model=FetchCompanyResponse)
@limiter.limit("2/second")
async def fetch_company_data(
    request: Request,
    orgnr: str,
    fetch_request: FetchCompanyRequest = FetchCompanyRequest(),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch company and optionally financial data from Brønnøysundregistrene
    and store it in the database
    """
    service = CompanyService(db)
    result = await service.fetch_and_store_company(orgnr, fetch_request.fetch_financials)
    return result


@router.get("/{orgnr}/subunits", response_model=SubUnitsWithMetadata)
@limiter.limit("5/second")
async def get_company_subunits(
    request: Request,
    orgnr: str = Path(..., min_length=9, max_length=9, pattern=r"^\d{9}$", description="9-digit organization number"),
    skip: int = Query(0, ge=0, description="Number of results to skip"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of results (max 500)"),
    force_refresh: bool = Query(False, description="Force refresh from API even if data exists"),
    db: AsyncSession = Depends(get_db),
    response: Response = None,  # type: ignore[assignment]
):
    """
    Get all subunits (underenheter/avdelinger) for a company.

    Uses lazy-loading: returns cached DB data if available, otherwise fetches from API.
    Set force_refresh=true to always fetch fresh data from Brønnøysundregistrene.

    Args:
        orgnr: 9-digit organization number
        skip: Pagination offset
        limit: Pagination limit (1-500)
        force_refresh: Force fetch from API
    """
    service = CompanyService(db)
    all_subunits = await service.get_subunits(orgnr, force_refresh=force_refresh)

    # Get parent company for metadata (reuse service to avoid double lookup)
    company = await service.get_company_with_accounting(orgnr)
    last_updated = company.raw_data.get("oppdatert") if company and company.raw_data else None

    # Apply pagination
    paginated = all_subunits[skip : skip + limit]

    # Convert to response models
    subunit_responses = [SubUnitResponse.model_validate(s) for s in paginated]

    # Set HTTP caching headers for subunit details
    if response:
        set_subunit_detail_cache(response, orgnr, len(all_subunits))

    return SubUnitsWithMetadata(
        data=subunit_responses,
        total=len(all_subunits),
        metadata=build_response_metadata(last_updated=last_updated),
    )


@router.get("/{orgnr}/roles", response_model=RolesWithMetadata)
@limiter.limit("5/second")
async def get_company_roles(
    request: Request,
    orgnr: str = Path(..., min_length=9, max_length=9, pattern=r"^\d{9}$", description="9-digit organization number"),
    force_refresh: bool = Query(False, description="Force refresh from API even if cached data exists"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all roles (roller) for a company.
    """
    role_service = RoleService(db)

    try:
        roles = await role_service.get_roles(orgnr, force_refresh=force_refresh)

        # Convert to response models
        role_responses = [RoleResponse.model_validate(r) for r in roles]

        return RolesWithMetadata(data=role_responses, total=len(role_responses), metadata=build_response_metadata())

    except BrregApiException as e:
        logging.warning(f"External API error fetching roles for {orgnr}: {e}")
        raise HTTPException(status_code=502, detail="Failed to fetch roles from Brønnøysund")
    except Exception as e:
        logging.exception(f"Unexpected error fetching roles for {orgnr}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
