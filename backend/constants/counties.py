"""Norwegian county (fylke) codes and names.

Based on 2024 regional structure (11 counties after 2020 reform).
County codes are first 2 digits of kommunenummer.

Note: Svalbard (21) is technically not a county but we treat it as one
for consistency in our dashboards.
"""

# County code -> County name mapping
COUNTY_NAMES = {
    "03": "Oslo",
    "11": "Rogaland",
    "15": "Møre og Romsdal",
    "18": "Nordland",
    "21": "Svalbard",  # Not technically a county, but treated as one
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


def get_county_name(county_code: str) -> str:
    """Get county name from 2-digit code."""
    return COUNTY_NAMES.get(county_code, f"Ukjent ({county_code})")


def get_all_county_codes() -> list[str]:
    """Get all valid county codes."""
    return list(COUNTY_NAMES.keys())
