"""
Sitemap router for SEO optimization.
Generates dynamic sitemap with company listings and structured pagination.

For 1.1M+ companies, uses Sitemap Index pattern:
- /sitemap_index.xml - Main index (lists all paginated sitemaps)
- /sitemaps/{page}.xml - Individual sitemaps (max 50,000 URLs per file)
"""

import math
import logging
import urllib.parse
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Path, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from limiter import limiter
from repositories.company.repository import CompanyRepository
from repositories.role_repository import RoleRepository
from services.seo_service import SEOService, STATIC_ROUTES, URLS_PER_SITEMAP

router: APIRouter = APIRouter(tags=["SEO"])
logger = logging.getLogger(__name__)

# Constants for sitemap pagination
BULK_FETCH_SIZE = 10000  # DB fetch batch size for memory efficiency


def get_seo_service(db: AsyncSession = Depends(get_db)) -> SEOService:
    """Dependency for SEOService."""
    return SEOService(db)


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


def calculate_sitemap_pages(total_count: int, offset: int = 0) -> int:
    """Calculate number of sitemap files needed"""
    return math.ceil((total_count + offset) / URLS_PER_SITEMAP)


@router.get("/sitemap_index.xml", response_class=Response)
@router.get("/sitemap-index.xml", response_class=Response)
@router.get("/sitemap.xml", response_class=Response)
@limiter.limit("60/minute")
async def get_sitemap_index(
    request: Request,
    seo_service: SEOService = Depends(get_seo_service),
):
    """
    Main Sitemap Index.
    Lists paginated sitemaps for both companies and people.
    """
    cache = await seo_service.get_sitemap_data()
    total_companies = cache["total_companies"]
    total_people = cache["total_people"]
    municipalities = cache["municipalities"]

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
        xml_content += f"    <loc>https://bedriftsgrafen.no/api/sitemaps/company-{page}.xml</loc>\n"
        xml_content += f"    <lastmod>{today}</lastmod>\n"
        xml_content += "  </sitemap>\n"

    # Add person sitemaps
    for page in range(1, num_person_pages + 1):
        xml_content += "  <sitemap>\n"
        xml_content += f"    <loc>https://bedriftsgrafen.no/api/sitemaps/person-{page}.xml</loc>\n"
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
    seo_service: SEOService = Depends(get_seo_service),
):
    """
    Get a paginated sitemap file.
    Supports 'company_{n}' and 'person_{n}' formats.
    """
    try:
        if "_" in filename:
            parts = filename.split("_")
        elif "-" in filename:
            parts = filename.split("-")
        else:
            raise ValueError("Invalid filename format")

        if len(parts) != 2:
            raise ValueError("Invalid filename format")

        sitemap_type = parts[0]
        page = int(parts[1])
    except (ValueError, IndexError):
        return Response(status_code=404)

    today = datetime.now().strftime("%Y-%m-%d")
    xml_content = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml_content += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    cache = await seo_service.get_sitemap_data()

    if sitemap_type == "company":
        municipalities = cache["municipalities"]
        anchors = cache["company_anchors"]

        # Handle static routes + municipalities on page 1
        limit = URLS_PER_SITEMAP
        after_orgnr = None
        offset = 0

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
        else:
            # Use keyset pagination for page 2+
            # anchor[page-2] is the starting orgnr for page N
            if page - 2 < len(anchors):
                after_orgnr = anchors[page - 2]
            else:
                # Handle out of bounds by falling back to potentially slow offset
                offset = (page - 1) * URLS_PER_SITEMAP - len(STATIC_ROUTES) - len(municipalities)

        company_repo = CompanyRepository(db)
        companies = await company_repo.get_paginated_orgnrs(offset=offset, limit=limit, after_orgnr=after_orgnr)

        for orgnr, updated_at in companies:
            xml_content += "  <url>\n"
            xml_content += f"    <loc>https://bedriftsgrafen.no/bedrift/{orgnr}</loc>\n"
            xml_content += f"    <lastmod>{format_date(updated_at)}</lastmod>\n"
            xml_content += "    <changefreq>weekly</changefreq>\n"
            xml_content += "    <priority>0.8</priority>\n"
            xml_content += "  </url>\n"

    elif sitemap_type == "person":
        anchors = cache["person_anchors"]

        offset = 0
        limit = URLS_PER_SITEMAP
        after_name = None
        after_birthdate = None

        if page > 1:
            # Use keyset pagination for page 2+
            if page - 2 < len(anchors):
                after_name, after_birthdate = anchors[page - 2]
            else:
                offset = (page - 1) * URLS_PER_SITEMAP

        role_repo = RoleRepository(db)
        people = await role_repo.get_paginated_commercial_people(
            offset=offset, limit=limit, after_name=after_name, after_birthdate=after_birthdate
        )

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
