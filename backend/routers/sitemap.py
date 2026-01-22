"""
Sitemap router for SEO optimization.
Generates dynamic sitemap with company listings and structured pagination.

For 1.1M+ companies, uses Sitemap Index pattern:
- /sitemap_index.xml - Main index (lists all paginated sitemaps)
- /sitemaps/{page}.xml - Individual sitemaps (max 50,000 URLs per file)
"""

import math
import urllib.parse
from datetime import datetime, timedelta
from typing import Any, Dict

from fastapi import APIRouter, Depends, Path, Request
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from limiter import limiter
from models import Company
from repositories.company.repository import CompanyRepository
from repositories.role_repository import RoleRepository
from repositories.stats_repository import StatsRepository

router: APIRouter = APIRouter(tags=["SEO"])

# Constants for sitemap pagination
URLS_PER_SITEMAP = 50000  # Google limit per file
BULK_FETCH_SIZE = 10000  # DB fetch batch size for memory efficiency

# Simple in-memory cache for total counts to avoid DB hammering
_cache: Dict[str, Any] = {
    "total_companies": None,
    "total_people": None,
    "municipalities": None,  # List of (code, lastmod)
    "expiry": None,
}
CACHE_TTL = timedelta(hours=6)

STATIC_ROUTES = [
    "",  # Homepage
    "utforsk",
    "konkurser",
    "nyetableringer",
    "bransjer",
    "kart",
    "sammenlign",
    "om",
]


def format_date(dt: Any) -> str:
    """Format datetime or string date to sitemap-compliant ISO string (YYYY-MM-DD)"""
    if dt is None:
        return datetime.now().strftime("%Y-%m-%d")
    if isinstance(dt, datetime):
        return dt.strftime("%Y-%m-%d")
    if isinstance(dt, str):
        # Brreg format often contains T
        return dt.split("T")[0]
    return datetime.now().strftime("%Y-%m-%d")


async def get_cached_counts(db: AsyncSession):
    """Get total counts with 6-hour caching"""
    now = datetime.now()
    if _cache["expiry"] is None or now > _cache["expiry"]:
        # Refresh cache
        company_stmt = select(func.count(Company.orgnr))
        company_result = await db.execute(company_stmt)
        _cache["total_companies"] = company_result.scalar() or 0

        role_repo = RoleRepository(db)
        _cache["total_people"] = await role_repo.count_commercial_people()

        stats_repo = StatsRepository(db)
        _cache["municipalities"] = await stats_repo.get_municipality_codes_with_updates()

        _cache["expiry"] = now + CACHE_TTL

    return _cache["total_companies"], _cache["total_people"], _cache["municipalities"]


def calculate_sitemap_pages(total_count: int, offset: int = 0) -> int:
    """Calculate number of sitemap files needed"""
    return math.ceil((total_count + offset) / URLS_PER_SITEMAP)


@router.get("/sitemap_index.xml", response_class=Response)
@limiter.limit("60/minute")
async def get_sitemap_index(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Main Sitemap Index.
    Lists paginated sitemaps for both companies and people.
    """
    total_companies, total_people, municipalities = await get_cached_counts(db)

    # Calculate pages
    num_company_pages = calculate_sitemap_pages(total_companies, offset=len(STATIC_ROUTES) + len(municipalities))
    num_person_pages = calculate_sitemap_pages(total_people)

    today = datetime.now().strftime("%Y-%m-%d")

    # Start XML
    xml_content = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml_content += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    # Add company sitemaps
    for page in range(1, num_company_pages + 1):
        xml_content += "  <sitemap>\n"
        xml_content += f"    <loc>https://bedriftsgrafen.no/api/sitemaps/company_{page}.xml</loc>\n"
        xml_content += f"    <lastmod>{today}</lastmod>\n"
        xml_content += "  </sitemap>\n"

    # Add person sitemaps
    for page in range(1, num_person_pages + 1):
        xml_content += "  <sitemap>\n"
        xml_content += f"    <loc>https://bedriftsgrafen.no/api/sitemaps/person_{page}.xml</loc>\n"
        xml_content += f"    <lastmod>{today}</lastmod>\n"
        xml_content += "  </sitemap>\n"

    xml_content += "</sitemapindex>"

    return Response(content=xml_content, media_type="application/xml")


@router.get("/sitemaps/{filename}.xml", response_class=Response)
@limiter.limit("30/minute")
async def get_paginated_sitemap(
    request: Request,
    filename: str = Path(..., description="Sitemap filename (e.g., company_1, person_1)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get a paginated sitemap file.
    Supports 'company_{n}' and 'person_{n}' formats.
    """
    try:
        parts = filename.split("_")
        if len(parts) != 2:
            raise ValueError("Invalid filename format")

        sitemap_type = parts[0]
        page = int(parts[1])
    except (ValueError, IndexError):
        return Response(status_code=404)

    today = datetime.now().strftime("%Y-%m-%d")
    xml_content = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml_content += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    if sitemap_type == "company":
        _, _, municipalities = await get_cached_counts(db)

        # Handle static routes + municipalities on page 1
        if page == 1:
            # Add Static Routes
            for route in STATIC_ROUTES:
                xml_content += "  <url>\n"
                xml_content += f"    <loc>https://bedriftsgrafen.no/{route}</loc>\n"
                xml_content += f"    <lastmod>{today}</lastmod>\n"
                xml_content += "    <changefreq>daily</changefreq>\n"
                xml_content += "    <priority>1.0</priority>\n"
                xml_content += "  </url>\n"

            # Add Municipality Dashboards with real lastmod
            for code, lastmod in municipalities:
                xml_content += "  <url>\n"
                xml_content += f"    <loc>https://bedriftsgrafen.no/kommune/{code}</loc>\n"
                xml_content += f"    <lastmod>{format_date(lastmod)}</lastmod>\n"
                xml_content += "    <changefreq>daily</changefreq>\n"
                xml_content += "    <priority>0.9</priority>\n"
                xml_content += "  </url>\n"

            limit = URLS_PER_SITEMAP - len(STATIC_ROUTES) - len(municipalities)
            offset = 0
        else:
            limit = URLS_PER_SITEMAP
            offset = (page - 1) * URLS_PER_SITEMAP - len(STATIC_ROUTES) - len(municipalities)

        company_repo = CompanyRepository(db)
        companies = await company_repo.get_paginated_orgnrs(offset=offset, limit=limit)

        for orgnr, updated_at in companies:
            xml_content += "  <url>\n"
            xml_content += f"    <loc>https://bedriftsgrafen.no/bedrift/{orgnr}</loc>\n"
            xml_content += f"    <lastmod>{format_date(updated_at)}</lastmod>\n"
            xml_content += "    <changefreq>weekly</changefreq>\n"
            xml_content += "    <priority>0.8</priority>\n"
            xml_content += "  </url>\n"

    elif sitemap_type == "person":
        offset = (page - 1) * URLS_PER_SITEMAP
        limit = URLS_PER_SITEMAP

        role_repo = RoleRepository(db)
        people = await role_repo.get_paginated_commercial_people(offset=offset, limit=limit)

        for name, birthdate, last_update in people:
            birthdate_str = birthdate.isoformat() if birthdate else "none"
            safe_name = urllib.parse.quote(name)
            xml_content += "  <url>\n"
            xml_content += f"    <loc>https://bedriftsgrafen.no/person/{safe_name}/{birthdate_str}</loc>\n"
            xml_content += f"    <lastmod>{format_date(last_update)}</lastmod>\n"
            xml_content += "    <changefreq>monthly</changefreq>\n"
            xml_content += "    <priority>0.6</priority>\n"
            xml_content += "  </url>\n"

    else:
        return Response(status_code=404)

    xml_content += "</urlset>"
    return Response(content=xml_content, media_type="application/xml")
