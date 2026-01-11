"""
Norwegian county (fylke) code mappings

Maps county codes (fylkesnummer) to their names and provides utility functions
for filtering companies by county using municipality number prefixes.

Reference: https://www.ssb.no/klass/klassifikasjoner/104
Updated for 2024 regional structure.
"""

# Type aliases for clarity
CountyCode = str  # 2-digit code like '03', '11'
CountyName = str  # Full name like 'Oslo', 'Rogaland'

# County codes (first 2 digits of kommunenummer) → county names
# Based on SSB classification 104 (Fylkesinndeling) - 2024 structure
COUNTY_CODES: dict[CountyCode, CountyName] = {
    "03": "Oslo",
    "11": "Rogaland",
    "15": "Møre og Romsdal",
    "18": "Nordland",
    "31": "Østfold",
    "32": "Akershus",
    "33": "Buskerud",
    "34": "Innlandet",
    "39": "Vestfold",
    "40": "Telemark",
    "42": "Agder",
    "46": "Vestland",
    "50": "Trøndelag",
    "55": "Troms",
    "56": "Finnmark",
}

# Reverse mapping for O(1) name -> code lookup (case-insensitive)
# Pre-computed at module load for performance
_COUNTY_NAME_TO_CODE: dict[str, CountyCode] = {name.lower(): code for code, name in COUNTY_CODES.items()}

# Valid county codes for O(1) membership check
VALID_COUNTY_CODES: frozenset[str] = frozenset(COUNTY_CODES.keys())


def get_county_code(county_name: str | None) -> CountyCode | None:
    """
    Get county code from county name (case-insensitive).

    Args:
        county_name: County name (e.g., 'Oslo', 'ROGALAND')

    Returns:
        2-digit county code or None if not found

    Performance:
        O(1) lookup using pre-computed lowercase mapping
    """
    if not county_name:
        return None

    name_lower = county_name.strip().lower()
    return _COUNTY_NAME_TO_CODE.get(name_lower)


def get_county_name(county_code: str | None) -> CountyName | None:
    """
    Get county name from county code.

    Args:
        county_code: 2-digit county code (e.g., '03', '11')

    Returns:
        County name or None if not found
    """
    if not county_code:
        return None

    # Handle both '3' and '03' inputs
    normalized = county_code.strip().zfill(2)
    return COUNTY_CODES.get(normalized)


def is_county_code(value: str | None) -> bool:
    """
    Check if a value is a valid 2-digit county code.

    Args:
        value: String to check

    Returns:
        True if valid county code
    """
    if not value:
        return False
    return len(value) == 2 and value in VALID_COUNTY_CODES


def get_all_counties() -> list[tuple[CountyCode, CountyName]]:
    """
    Get all counties as (code, name) tuples, sorted by name.

    Returns:
        List of (code, name) tuples sorted alphabetically by name
    """
    return sorted(COUNTY_CODES.items(), key=lambda x: x[1])
