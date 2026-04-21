"""
Organizational form constants and filtering logic.
Based on Enhetsregisterloven § 22: Roles in commercial entities must be
separated from roles in voluntary organizations when mapped to individuals.
"""

# Whitelist of organizational forms considered "næringsvirksomhet" (commercial)
# These are safe to show together in a person-role mapping.
# NOTE: The primary check should ALWAYS be `registrert_i_foretaksregisteret == True`.
# These lists are for fallback when that flag is False or for additional filtering.
COMMERCIAL_ORG_FORMS = frozenset(
    {
        "AS",  # Aksjeselskap
        "ASA",  # Allmennaksjeselskap
        "ENK",  # Enkeltpersonforetak (Commercial focus)
        "ANS",  # Ansvarlig selskap
        "DA",  # Selskap med delt ansvar
        "NUF",  # Norsk avdeling av utenlandsk foretak
        "KS",  # Kommandittselskap
        "SAM",  # Samvirkeforetak (if commercial purpose)
        "IKS",  # Interkommunalt selskap (NOTE: also in PUBLIC_ORG_FORMS; excluded by is_private_commercial)
    }
)

# Blacklist of organizational forms definitively considered private/voluntary.
# Roles in these entities MUST NOT be shown alongside the commercial roles.
NON_COMMERCIAL_ORG_FORMS = frozenset(
    {
        "FLI",  # Forening/lag/innretning (Clubs, associations, NGOs)
        "BRL",  # Borettslag (Housing co-ops - private living situation)
        "ESEK",  # Eierseksjonssameie (Condominiums - private living situation)
        "ANNA",  # Annen juridisk person
    }
)

# Special handling for Stiftelser (Foundations)
# STI is commercial ONLY if registered in Foretaksregisteret.
FOUNDATION_ORG_FORM = "STI"

# Public / governmental entities that ARE registered in Foretaksregisteret
# (or look commercial) but must be excluded from private-commercial leaderboards.
# Examples: state health trusts (SÆR = helseforetak), municipal/county bodies,
# inter-municipal companies, state enterprises.
PUBLIC_ORG_FORMS = frozenset(
    {
        "SÆR",  # Selskap med særskilt lov (e.g. helseforetak, statsforetak NHF-type)
        "ORGL",  # Organisasjonsledd (statlig/kommunalt)
        "KOMM",  # Kommune
        "FYLK",  # Fylkeskommune
        "STAT",  # Staten
        "KF",  # Kommunalt foretak
        "FKF",  # Fylkeskommunalt foretak
        "SF",  # Statsforetak
        "KIRK",  # Den norske kirke
        "IKS",  # Interkommunalt selskap
        "OPMV",  # Særskilt oppdelt enhet
    }
)


def is_private_commercial(org_form: str | None, is_in_foretaksreg: bool) -> bool:
    """Stricter than `is_commercial_role`: excludes public/governmental entities
    and non-commercial org forms (associations, foundations, etc.) regardless of
    foretaksregisteret status.

    Use for commercial leaderboards (revenue, profit, employees) where the goal
    is to surface private business leaders, not state sector executives.
    Returns False for None org_form.
    """
    if org_form is None:
        return False
    if org_form in NON_COMMERCIAL_ORG_FORMS:
        return False
    if not is_commercial_role(org_form, is_in_foretaksreg):
        return False
    return org_form not in PUBLIC_ORG_FORMS


def is_commercial_role(company_org_form: str, is_registered_in_foretaksreg: bool) -> bool:
    """
    Determines if a role in a company is safe to display in a person-centric mapping.
    Based on Enhetsregisterloven § 22.
    """
    # 1. Primary rule: If registered in Foretaksregisteret, it's commercial.
    if is_registered_in_foretaksreg:
        return True

    # 2. Secondary rule: Check org form whitelist/blacklist
    if company_org_form in NON_COMMERCIAL_ORG_FORMS:
        return False

    # Default to True for known commercial forms, False for safety (e.g., STI without Foretaksreg or unknown forms)
    return company_org_form in COMMERCIAL_ORG_FORMS
