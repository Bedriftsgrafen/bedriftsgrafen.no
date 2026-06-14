import logging
import os
from pathlib import Path as FilePath
from urllib.parse import urlparse

from dotenv import dotenv_values
from fastapi import APIRouter, HTTPException, Path
from fastapi.responses import RedirectResponse

logger = logging.getLogger(__name__)

AFFILIATE_ENV_VARS: dict[str, str] = {
    "tjenestetorget": "TJENESTETORGET_SPORINGSLENKE",
    "klikklaan": "KLIKKLAAN_SPORINGSLENKE",
    "zensum": "ZENSUM_SPORINGSLENKE",
    "rentesjekk": "RENTESJEKK_SPORINGSLENKE",
    "tjenestetorget-forsikring": "TJENESTETORGET_FORSIKRING_SPORINGSLENKE",
    "uscore": "USCORE_SPORINGSLENKE",
}

ENV_FILE_CANDIDATES = (
    FilePath(__file__).resolve().parents[3] / ".env",
    FilePath(__file__).resolve().parents[2] / ".env",
)

router = APIRouter(prefix="/v1/affiliates", tags=["affiliates"])


def get_configured_env_value(env_var: str) -> str:
    env_value = os.getenv(env_var, "").strip()
    if env_value:
        return env_value

    for env_file in ENV_FILE_CANDIDATES:
        if not env_file.is_file():
            continue
        file_value = dotenv_values(env_file).get(env_var, "")
        if file_value:
            return file_value.strip()

    return ""


def get_affiliate_tracking_url(affiliate_id: str) -> str:
    env_var = AFFILIATE_ENV_VARS.get(affiliate_id)
    if env_var is None:
        raise HTTPException(status_code=404, detail="Affiliate not found")

    tracking_url = get_configured_env_value(env_var)
    parsed = urlparse(tracking_url)
    if not tracking_url or parsed.scheme != "https" or not parsed.netloc:
        logger.warning("Affiliate redirect unavailable", extra={"affiliate_id": affiliate_id})
        raise HTTPException(status_code=404, detail="Affiliate not configured")

    return tracking_url


@router.get(
    "/{affiliate_id}",
    response_class=RedirectResponse,
    responses={
        302: {"description": "Redirect to affiliate tracking URL"},
        404: {"description": "Affiliate is not configured"},
    },
)
async def redirect_affiliate(
    affiliate_id: str = Path(..., description="Affiliate identifier"),
) -> RedirectResponse:
    tracking_url = get_affiliate_tracking_url(affiliate_id)
    logger.info("Affiliate redirect", extra={"affiliate_id": affiliate_id})
    response = RedirectResponse(url=tracking_url, status_code=302)
    response.headers["Cache-Control"] = "no-store"
    return response
