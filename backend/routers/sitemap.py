"""
Sitemap router for SEO optimization.
Generates dynamic sitemap with company listings and structured pagination.

For 1.1M+ companies, uses Sitemap Index pattern:
- /sitemap_index.xml - Main index (lists all paginated sitemaps)
- /sitemaps/{page}.xml - Individual sitemaps (max 50,000 URLs per file)
"""

import math
from datetime import datetime

from fastapi import APIRouter, Depends, Path, Request
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from constants.org_forms import COMMERCIAL_ORG_FORMS, NON_COMMERCIAL_ORG_FORMS
from database import get_db
from main import limiter
from models import Company, Role

router = APIRouter(tags=["SEO"])

# Constants for sitemap pagination
URLS_PER_SITEMAP = 50000  # Google limit per file
BULK_FETCH_SIZE = 10000  # DB fetch batch size for memory efficiency

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


async def get_total_company_count(db: AsyncSession) -> int:
    """Get total count of companies in database"""
    stmt = select(func.count(Company.orgnr))
    result = await db.execute(stmt)
    return result.scalar() or 0


async def get_total_person_count(db: AsyncSession) -> int:
    """
    Get total count of unique people with commercial roles.
    Follows Enhetsregisterloven § 22 filtering logic.
    """
    # Build subquery for commercial filtering to match RoleRepository
    commercial_stmt = (
        select(Role.person_navn, Role.foedselsdato)
        .join(Company, Role.orgnr == Company.orgnr)
        .where(Role.person_navn.is_not(None))
        .where(
            (Company.registrert_i_foretaksregisteret == True)  # noqa: E712
            | (
                Company.organisasjonsform.in_(list(COMMERCIAL_ORG_FORMS))
                & ~Company.organisasjonsform.in_(list(NON_COMMERCIAL_ORG_FORMS))
                & (Company.organisasjonsform != "STI")
            )
        )
        .group_by(Role.person_navn, Role.foedselsdato)
    )

    # Count the unique pairs
    stmt = select(func.count()).select_from(commercial_stmt.subquery())
    result = await db.execute(stmt)
    return result.scalar() or 0


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
    total_companies = await get_total_company_count(db)
    total_people = await get_total_person_count(db)

    # Calculate pages (static routes included in company_1.xml)
    num_company_pages = calculate_sitemap_pages(total_companies, offset=len(STATIC_ROUTES))
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
        # Handle static routes on page 1
        if page == 1:
            for route in STATIC_ROUTES:
                xml_content += "  <url>\n"
                xml_content += f"    <loc>https://bedriftsgrafen.no/{route}</loc>\n"
                xml_content += f"    <lastmod>{today}</lastmod>\n"
                xml_content += "    <changefreq>daily</changefreq>\n"
                xml_content += "    <priority>1.0</priority>\n"
                xml_content += "  </url>\n"
            limit = URLS_PER_SITEMAP - len(STATIC_ROUTES)
            offset = 0
        else:
            limit = URLS_PER_SITEMAP
            offset = (page - 1) * URLS_PER_SITEMAP - len(STATIC_ROUTES)

        stmt = select(Company.orgnr).order_by(Company.orgnr).offset(offset).limit(limit)
        result = await db.execute(stmt)
        for orgnr in result.scalars():
            xml_content += "  <url>\n"
            xml_content += f"    <loc>https://bedriftsgrafen.no/bedrift/{orgnr}</loc>\n"
            xml_content += f"    <lastmod>{today}</lastmod>\n"
            xml_content += "    <changefreq>weekly</changefreq>\n"
            xml_content += "    <priority>0.8</priority>\n"
            xml_content += "  </url>\n"

    elif sitemap_type == "person":
        offset = (page - 1) * URLS_PER_SITEMAP
        limit = URLS_PER_SITEMAP

        # Commercial filtering matching get_total_person_count
        stmt = (
            select(Role.person_navn, Role.foedselsdato)
            .join(Company, Role.orgnr == Company.orgnr)
            .where(Role.person_navn.is_not(None))
            .where(
                (Company.registrert_i_foretaksregisteret == True)  # noqa: E712
                | (
                    Company.organisasjonsform.in_(list(COMMERCIAL_ORG_FORMS))
                    & ~Company.organisasjonsform.in_(list(NON_COMMERCIAL_ORG_FORMS))
                    & (Company.organisasjonsform != "STI")
                )
            )
            .group_by(Role.person_navn, Role.foedselsdato)
            .order_by(Role.person_navn)
            .offset(offset)
            .limit(limit)
        )

        result = await db.execute(stmt)
        for name, birthdate in result.all():
            birthdate_str = birthdate.isoformat() if birthdate else "none"
            # URL friendly escaping would be better but simple f-string for now as per current pattern
            # Frontend route: person/$name/$birthdate
            xml_content += "  <url>\n"
            xml_content += f"    <loc>https://bedriftsgrafen.no/person/{name}/{birthdate_str}</loc>\n"
            xml_content += f"    <lastmod>{today}</lastmod>\n"
            xml_content += "    <changefreq>monthly</changefreq>\n"
            xml_content += "    <priority>0.6</priority>\n"
            xml_content += "  </url>\n"

    else:
        return Response(status_code=404)

    xml_content += "</urlset>"
    return Response(content=xml_content, media_type="application/xml")
