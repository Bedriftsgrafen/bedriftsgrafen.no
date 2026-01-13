"""
Organizational form constants and filtering logic.
Based on Enhetsregisterloven § 22: Roles in commercial entities must be
separated from roles in voluntary organizations when mapped to individuals.
"""

# Whitelist of organizational forms considered "næringsvirksomhet" (commercial)
# These are safe to show together in a person-role mapping.
# NOTE: The primary check should ALWAYS be `registrert_i_foretaksregisteret == True`.
# These lists are for fallback when that flag is False or for additional filtering.
COMMERCIAL_ORG_FORMS = {
    "AS",  # Aksjeselskap
    "ASA",  # Allmennaksjeselskap
    "ENK",  # Enkeltpersonforetak (Commercial focus)
    "ANS",  # Ansvarlig selskap
    "DA",  # Selskap med delt ansvar
    "NUF",  # Norsk avdeling av utenlandsk foretak
    "KS",  # Kommandittselskap
    "SAM",  # Samvirkeforetak (if commercial purpose)
    "IKS",  # Interkommunalt selskap
}

# Blacklist of organizational forms definitively considered private/voluntary.
# Roles in these entities MUST NOT be shown alongside the commercial roles.
NON_COMMERCIAL_ORG_FORMS = {
    "FLI",  # Forening/lag/innretning (Clubs, associations, NGOs)
    "BRL",  # Borettslag (Housing co-ops - private living situation)
    "ESEK",  # Eierseksjonssameie (Condominiums - private living situation)
    "ANNA",  # Annen juridisk person
}

# Special handling for Stiftelser (Foundations)
# STI is commercial ONLY if registered in Foretaksregisteret.
FOUNDATION_ORG_FORM = "STI"


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

    if company_org_form in COMMERCIAL_ORG_FORMS:
        return True

    # 3. Default to False for safety (e.g., STI without Foretaksreg or unknown forms)
    return False
