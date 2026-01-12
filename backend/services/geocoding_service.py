"""
Geocoding Service using Kartverket Adresse-API.
ROBUST VERSION: Prioritizes Vegadresse > Gateadresse. Avoids Eiendom (ocean centroids).
"""

import logging
import re
import httpx

from services.base_external_service import BaseExternalService, ExternalApiException

logger = logging.getLogger(__name__)


class GeocodingService(BaseExternalService):
    SERVICE_NAME = "Kartverket"
    BASE_URL = "https://ws.geonorge.no/adresser/v1/sok"
    DEFAULT_TIMEOUT = 10.0

    # Manual overrides for companies with bad registry data (e.g. centroid in ocean)
    GEOCODING_OVERRIDES: dict[str, tuple[float, float]] = {
        # "993144169": (59.923000, 10.681140),
    }

    def __init__(self, client: httpx.AsyncClient | None = None):
        super().__init__(client=client)

    async def geocode_address(self, address: str, orgnr: str | None = None) -> tuple[float, float] | None:
        """
        Geocode a Norwegian address using Kartverket API with smart filtering.
        If orgnr is provided, manual overrides are checked first.
        """
        if orgnr and orgnr in self.GEOCODING_OVERRIDES:
            logger.info(f"Applying geocoding override for {orgnr}")
            return self.GEOCODING_OVERRIDES[orgnr]

        if not address or len(address.strip()) < 2:
            return None

        simple_address = self._extract_street_and_number(address)
        zip_code = self._extract_zip_code(address)

        search_query = simple_address if simple_address else address.replace("Postboks", "").strip()

        params = {"sok": search_query, "treffPerSide": 10, "utkoordsys": "4258", "asciiKompatibel": "true"}

        if zip_code:
            params["postnummer"] = zip_code

        try:
            # First attempt
            response = await self._get(self.BASE_URL, params=params, context=f"address '{search_query}'")

            # Since _get returns response even on 404 (though Kartverket usually returns 200 with empty list), we check status
            if response.status_code != 200:
                return None

            data = response.json()
            addresses = data.get("adresser", [])

            if not addresses and zip_code:
                # Fallback: Try WITHOUT zip code
                logger.debug(f"No results with zip {zip_code}, retrying without...")
                params.pop("postnummer")
                response = await self._get(self.BASE_URL, params=params, context=f"address '{search_query}' (no zip)")
                if response.status_code == 200:
                    addresses = response.json().get("adresser", [])

            if not addresses:
                logger.debug(f"No results found for: {search_query}")
                return None

            return self._extract_best_coords(addresses, search_query)

        except ExternalApiException:
            logger.warning(f"Geocoding failed for {address}")
            return None
        except Exception as e:
            logger.error(f"Unexpected geocoding error for {address}: {e}")
            return None

    def _extract_best_coords(self, addresses: list[dict], search_query: str) -> tuple[float, float] | None:
        # Priority 1: Vegadresse (The gold standard - entrance/building point)
        for hit in addresses:
            if hit.get("objtype") == "Vegadresse":
                lat, lon = self._extract_coords(hit)
                if lat and lon:
                    logger.info(f"✅ Fixed '{search_query}' -> Vegadresse (On Land): {lat}, {lon}")
                    return (lat, lon)

        # Priority 2: Gateadresse (Older, but usually safe)
        for hit in addresses:
            if hit.get("objtype") == "Gateadresse":
                lat, lon = self._extract_coords(hit)
                if lat and lon:
                    logger.info(f"☑️ Fallback '{search_query}' -> Gateadresse: {lat}, {lon}")
                    return (lat, lon)

        # Priority 3: Eiendom (DANGEROUS - often in water)
        logger.warning(f"⚠️ Only 'Eiendom' found for '{search_query}'. Skipping to avoid ocean coordinates.")
        return None

    @staticmethod
    def _extract_coords(hit: dict) -> tuple[float, float] | tuple[None, None]:
        """Helper to safely extract lat/lon."""
        point = hit.get("representasjonspunkt", {})
        lat = point.get("lat")
        lon = point.get("lon")
        if lat is not None and lon is not None:
            return float(lat), float(lon)
        return None, None

    @staticmethod
    def _extract_zip_code(full_address: str) -> str | None:
        """Extracts 4-digit postal code."""
        match = re.search(r"\b(\d{4})\b", full_address)
        if match:
            return match.group(1)
        return None

    @staticmethod
    def _extract_street_and_number(full_address: str) -> str | None:
        """
        Extracts 'Streetname 123A' from 'Streetname 123A, 0000 City'.
        """
        match = re.match(r"^([^\d]+ \d+[A-Za-z]?)", full_address)
        if match:
            return match.group(1).strip()
        return None

    @staticmethod
    def build_address_string(forretningsadresse: dict, postadresse: dict | None = None) -> str | None:
        """
        Build a geocodable address string.

        Handles edge cases like:
        - "c/o Name" lines (skip them)
        - "Postboks" addresses (skip them, use street if available)
        - Multiple address lines (find the actual street)
        """
        addr = forretningsadresse or postadresse
        if not addr:
            return None

        parts = []
        adresse_list = addr.get("adresse", [])

        if adresse_list and isinstance(adresse_list, list):
            # Find the actual street address (skip c/o, Att:, Postboks prefixes)
            street = None
            for line in adresse_list:
                if not line:
                    continue
                line_lower = line.lower().strip()
                # Skip non-street lines
                if any(line_lower.startswith(prefix) for prefix in ["c/o", "att:", "att ", "v/", "postboks", "pb "]):
                    continue
                # This looks like a street address
                street = line.strip()
                break

            if street:
                parts.append(street)

        postnummer = addr.get("postnummer")
        poststed = addr.get("poststed")

        if postnummer and poststed:
            parts.append(f"{postnummer} {poststed}")
        elif postnummer:
            parts.append(postnummer)
        elif poststed:
            parts.append(poststed)

        if not parts:
            return None
        return ", ".join(parts)
