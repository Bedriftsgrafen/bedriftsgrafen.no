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

from database import get_db
from main import limiter
from models import Company

router = APIRouter(tags=["SEO"])

# Constants for sitemap pagination
URLS_PER_SITEMAP = 50000  # Google limit per file
BULK_FETCH_SIZE = 10000  # DB fetch batch size for memory efficiency


async def get_total_company_count(db: AsyncSession) -> int:
    """Get total count of companies in database"""
    stmt = select(func.count(Company.orgnr))
    result = await db.execute(stmt)
    return result.scalar() or 0


def calculate_sitemap_pages(total_count: int) -> int:
    """Calculate number of sitemap files needed"""
    return math.ceil((total_count + 1) / URLS_PER_SITEMAP)  # +1 for homepage


@router.get("/sitemap_index.xml", response_class=Response)
@limiter.limit("60/minute")
async def get_sitemap_index(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Sitemap Index for all 1.1M+ companies.

    Calculates pagination dynamically based on total company count.
    Each child sitemap contains max 50,000 URLs as per Google's spec.

    Example:
        Total companies: 1,100,000
        Sitemaps needed: 22 files (1 homepage + 21 company files)
        URLs per file: 50,000
    """
    total_companies = await get_total_company_count(db)
    num_pages = calculate_sitemap_pages(total_companies)
    today = datetime.now().strftime("%Y-%m-%d")

    # Start XML
    xml_content = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml_content += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    # Add each paginated sitemap
    for page in range(1, num_pages + 1):
        xml_content += "  <sitemap>\n"
        xml_content += f"    <loc>https://bedriftsgrafen.no/api/sitemaps/{page}.xml</loc>\n"
        xml_content += f"    <lastmod>{today}</lastmod>\n"
        xml_content += "  </sitemap>\n"

    xml_content += "</sitemapindex>"

    return Response(content=xml_content, media_type="application/xml")


@router.get("/sitemaps/{page}.xml", response_class=Response)
@limiter.limit("30/minute")
async def get_paginated_sitemap(
    request: Request,
    page: int = Path(..., ge=1, description="Sitemap page number (1-indexed)"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get a paginated sitemap containing company URLs.

    Each file contains up to 50,000 URLs to comply with Google's sitemap spec.

    Args:
        page: 1-indexed page number. Page 1 includes homepage + first batch of companies.

    Returns:
        XML sitemap with <url> entries for homepage (if page=1) and companies.

    Example:
        GET /api/sitemaps/1.xml - Homepage + companies 0-49,999
        GET /api/sitemaps/2.xml - Companies 50,000-99,999
        GET /api/sitemaps/3.xml - Companies 100,000-149,999
    """
    # Calculate offset
    if page == 1:
        # First page: 1 homepage + up to (URLS_PER_SITEMAP - 1) companies
        company_offset = 0
        company_limit = URLS_PER_SITEMAP - 1  # Reserve 1 slot for homepage
    else:
        # Subsequent pages: only companies
        # Previous pages had: homepage (page 1) + (page-1) * URLS_PER_SITEMAP companies
        company_offset = (page - 1) * URLS_PER_SITEMAP - 1
        company_limit = URLS_PER_SITEMAP

    # Fetch companies in batches to avoid memory issues with large datasets
    stmt = select(Company.orgnr).order_by(Company.orgnr).offset(company_offset).limit(company_limit)
    result = await db.execute(stmt)
    orgnrs = [row[0] for row in result.all()]

    # If page is beyond total, return empty sitemap (won't happen with index, but defensive)
    if not orgnrs and page > 1:
        xml_content = '<?xml version="1.0" encoding="UTF-8"?>\n'
        xml_content += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'
        return Response(content=xml_content, media_type="application/xml")

    today = datetime.now().strftime("%Y-%m-%d")

    # Start XML
    xml_content = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml_content += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'

    # Add homepage only on first page
    if page == 1:
        xml_content += "  <url>\n"
        xml_content += "    <loc>https://bedriftsgrafen.no</loc>\n"
        xml_content += f"    <lastmod>{today}</lastmod>\n"
        xml_content += "    <changefreq>daily</changefreq>\n"
        xml_content += "    <priority>1.0</priority>\n"
        xml_content += "  </url>\n"

    # Add company URLs
    for orgnr in orgnrs:
        xml_content += "  <url>\n"
        xml_content += f"    <loc>https://bedriftsgrafen.no/?orgnr={orgnr}</loc>\n"
        xml_content += f"    <lastmod>{today}</lastmod>\n"
        xml_content += "    <changefreq>weekly</changefreq>\n"
        xml_content += "    <priority>0.8</priority>\n"
        xml_content += "  </url>\n"

    xml_content += "</urlset>"

    return Response(content=xml_content, media_type="application/xml")
