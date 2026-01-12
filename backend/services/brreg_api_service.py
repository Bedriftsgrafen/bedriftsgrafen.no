"""
BrregApiService - Fetches data from Brønnøysundregistrene APIs.

Inherits from BaseExternalService for common HTTP client and retry logic.
"""

import logging
from typing import Any

from services.base_external_service import BaseExternalService, ExternalApiException

logger = logging.getLogger(__name__)

# Re-export exceptions for backward compatibility
BrregApiException = ExternalApiException


class BrregApiService(BaseExternalService):
    """
    Service for fetching data from Brønnøysundregistrene APIs:
    - Enhetsregisteret: Company registry
    - Regnskapsregisteret: Financial statements registry
    """

    SERVICE_NAME = "Brønnøysund"
    ENHETSREGISTERET_BASE_URL = "https://data.brreg.no/enhetsregisteret/api"
    REGNSKAPSREGISTERET_BASE_URL = "https://data.brreg.no/regnskapsregisteret/regnskap"

    async def fetch_company(self, orgnr: str) -> dict[str, Any] | None:
        """
        Fetch company details from Enhetsregisteret.

        Args:
            orgnr: Organization number (9 digits)

        Returns:
            Company data as dict or None if not found
        """
        url = f"{self.ENHETSREGISTERET_BASE_URL}/enheter/{orgnr}"
        return await self._fetch_and_handle_404(url, context=f"company {orgnr}")

    async def fetch_financial_statements(self, orgnr: str, year: int | None = None) -> list[dict[str, Any]]:
        """
        Fetch financial statements from Regnskapsregisteret.

        Args:
            orgnr: Organization number (9 digits)
            year: Specific year to fetch (optional)

        Returns:
            List of financial statements
        """
        url = f"{self.REGNSKAPSREGISTERET_BASE_URL}/{orgnr}"
        params = {}

        if year:
            params["regnskapsperiode.fraDato"] = f"{year}-01-01"
            params["regnskapsperiode.tilDato"] = f"{year}-12-31"

        data = await self._fetch_and_handle_404(url, params=params or None, context=f"financials {orgnr}")
        return data if isinstance(data, list) else []

    async def _fetch_and_handle_404(
        self,
        url: str,
        params: dict[str, Any] | None = None,
        context: str = "request"
    ) -> Any | None:
        """Helper to fetch data and return None on 404."""
        try:
            response = await self._get(url, params=params, context=context)
            if response.status_code == 404:
                logger.info(f"{context} not found")
                return None
            return response.json()
        except ExternalApiException:
            raise
        except Exception as e:
            logger.warning(f"Unexpected error fetching {context}: {e}")
            return None

    async def parse_financial_data(self, raw_data: dict[str, Any]) -> dict[str, Any]:
        """
        Parse raw financial statement data into structured format.
        """
        parsed: dict[str, Any] = {
            "aar": None,
            "periode_fra": None,
            "periode_til": None,
            "total_inntekt": None,
            "aarsresultat": None,
            "driftsresultat": None,
            "salgsinntekter": None,
            "egenkapital": None,
            "omloepsmidler": None,
            "kortsiktig_gjeld": None,
            "avskrivninger": None,
            "anleggsmidler": None,
            "langsiktig_gjeld": None,
        }

        try:
            # Extract fiscal period dates
            if "regnskapsperiode" in raw_data:
                fra_dato = raw_data["regnskapsperiode"].get("fraDato")
                til_dato = raw_data["regnskapsperiode"].get("tilDato")

                # Ensure dates are in YYYY-MM-DD format (truncate ISO timestamps)
                if fra_dato:
                    parsed["periode_fra"] = fra_dato[:10] if len(fra_dato) >= 10 else fra_dato
                if til_dato:
                    parsed["periode_til"] = til_dato[:10] if len(til_dato) >= 10 else til_dato

                if til_dato:
                    parsed["aar"] = int(til_dato[:4])
                elif fra_dato:
                    parsed["aar"] = int(fra_dato[:4])

            # Parse income statement and balance sheet
            resultat = raw_data.get("resultatregnskapResultat", {})
            eiendeler = raw_data.get("eiendeler", {})
            egenkapital_gjeld = raw_data.get("egenkapitalGjeld", {})

            driftsresultat_data = resultat.get("driftsresultat", {})
            driftsinntekter = driftsresultat_data.get("driftsinntekter", {})

            parsed["salgsinntekter"] = self._extract_value(driftsinntekter, "sumDriftsinntekter")
            parsed["driftsresultat"] = self._extract_value(driftsresultat_data, "driftsresultat")
            parsed["aarsresultat"] = self._extract_value(resultat, "aarsresultat")

            driftskostnad = driftsresultat_data.get("driftskostnad", {})
            parsed["avskrivninger"] = self._extract_value(driftskostnad, "avskrivninger")

            egenkapital_data = egenkapital_gjeld.get("egenkapital", {})
            gjeld = egenkapital_gjeld.get("gjeldOversikt", {})

            parsed["egenkapital"] = self._extract_value(egenkapital_data, "sumEgenkapital")
            parsed["omloepsmidler"] = self._extract_value(eiendeler.get("omloepsmidler", {}), "sumOmloepsmidler")
            parsed["anleggsmidler"] = self._extract_value(eiendeler.get("anleggsmidler", {}), "sumAnleggsmidler")
            parsed["kortsiktig_gjeld"] = self._extract_value(gjeld.get("kortsiktigGjeld", {}), "sumKortsiktigGjeld")
            parsed["langsiktig_gjeld"] = self._extract_value(gjeld.get("langsiktigGjeld", {}), "sumLangsiktigGjeld")

        except Exception as e:
            logger.error(f"Error parsing financial data: {str(e)}")

        return parsed

    def _extract_value(self, data: dict, key: str) -> float | None:
        """Extract numeric value from nested dict."""
        if not data:
            return None
        value = data.get(key)
        if value is None:
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None

    async def fetch_subunits(self, parent_orgnr: str) -> list[dict[str, Any]]:
        """
        Fetch all subunits (underenheter) for a parent company.
        Handles pagination automatically.
        """
        url = f"{self.ENHETSREGISTERET_BASE_URL}/underenheter"
        params = {"overordnetEnhet": parent_orgnr, "size": 100}

        all_subunits = []
        page_count = 0
        max_pages = 50

        while url and page_count < max_pages:
            page_count += 1
            try:
                current_params = params if page_count == 1 else None
                response = await self._get(url, params=current_params, context=f"subunits {parent_orgnr} p{page_count}")

                if response.status_code == 404:
                    logger.info(f"No subunits found for {parent_orgnr}")
                    return []

                data = response.json()

                if "_embedded" in data and "underenheter" in data["_embedded"]:
                    subunits = data["_embedded"]["underenheter"]
                    all_subunits.extend(subunits)
                    logger.debug(f"Fetched {len(subunits)} subunits for {parent_orgnr}, page {page_count}")

                url = data["_links"]["next"]["href"] if "_links" in data and "next" in data["_links"] else ""

            except Exception as e:
                logger.error(f"Error fetching subunits for {parent_orgnr}: {str(e)}")
                raise

        if page_count >= max_pages:
            logger.warning(f"Hit max page limit ({max_pages}) for subunits of {parent_orgnr}")

        logger.info(f"Fetched {len(all_subunits)} total subunits for {parent_orgnr}")
        return all_subunits

    async def fetch_roles(self, orgnr: str) -> list[dict[str, Any]]:
        """
        Fetch all roles (roller) for a company.
        """
        url = f"{self.ENHETSREGISTERET_BASE_URL}/enheter/{orgnr}/roller"

        try:
            response = await self._get(url, context=f"roles {orgnr}")
            if response.status_code == 404:
                logger.info(f"No roles found for {orgnr}")
                return []

            data = response.json()
            all_roles = []
            rollegrupper = data.get("rollegrupper", [])

            for gruppe in rollegrupper:
                gruppe_type = gruppe.get("type", {})
                rolle_kode = gruppe_type.get("kode", "")
                rolle_beskrivelse = gruppe_type.get("beskrivelse", "")

                for roller_item in gruppe.get("roller", []):
                    role_data = {
                        "type_kode": rolle_kode,
                        "type_beskrivelse": rolle_beskrivelse,
                        "person_navn": None,
                        "foedselsdato": None,
                        "enhet_orgnr": None,
                        "enhet_navn": None,
                        "fratraadt": roller_item.get("fratraadt", False),
                        "rekkefoelge": roller_item.get("rekkefoelge"),
                    }

                    person = roller_item.get("person", {})
                    if person:
                        navn = person.get("navn", {})
                        fornavn = navn.get("fornavn", "")
                        mellomnavn = navn.get("mellomnavn", "")
                        etternavn = navn.get("etternavn", "")

                        full_name_parts = [fornavn, mellomnavn, etternavn]
                        role_data["person_navn"] = " ".join(p for p in full_name_parts if p)
                        role_data["foedselsdato"] = person.get("fodselsdato")

                    enhet = roller_item.get("enhet", {})
                    if enhet:
                        role_data["enhet_orgnr"] = enhet.get("organisasjonsnummer")
                        navn_list = enhet.get("navn", [])
                        if isinstance(navn_list, list) and navn_list:
                            role_data["enhet_navn"] = navn_list[0]
                        elif isinstance(navn_list, str):
                            role_data["enhet_navn"] = navn_list

                    all_roles.append(role_data)

            logger.info(f"Fetched {len(all_roles)} roles for {orgnr}")
            return all_roles

        except ExternalApiException:
            raise
        except Exception as e:
            logger.error(f"Error fetching roles for {orgnr}: {str(e)}")
            return []
