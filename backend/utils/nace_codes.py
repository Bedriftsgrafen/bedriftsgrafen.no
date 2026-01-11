"""
NACE section code mappings (SSB Standard)

Maps top-level NACE section letters (A-U) to their corresponding
numeric division ranges. Used for filtering companies by industry section.

Reference: https://www.ssb.no/klass/klassifikasjoner/6
"""

# Type aliases for clarity
NaceSectionLetter = str  # Single uppercase letter A-U
NaceDivisionCode = str  # 2-digit numeric code like '41', '62'

# NACE section data: letter -> (tuple of division codes, Norwegian name)
# Consolidated to avoid duplication (DRY principle)
_NACE_SECTIONS: dict[str, tuple[tuple[str, ...], str]] = {
    "A": (("01", "02", "03"), "Jordbruk, skogbruk og fiske"),
    "B": (("05", "06", "07", "08", "09"), "Bergverksdrift og utvinning"),
    "C": (
        (
            "10",
            "11",
            "12",
            "13",
            "14",
            "15",
            "16",
            "17",
            "18",
            "19",
            "20",
            "21",
            "22",
            "23",
            "24",
            "25",
            "26",
            "27",
            "28",
            "29",
            "30",
            "31",
            "32",
            "33",
        ),
        "Industri",
    ),
    "D": (("35",), "Elektrisitets-, gass-, damp- og varmtvannsforsyning"),
    "E": (("36", "37", "38", "39"), "Vannforsyning, avløps- og renovasjonsvirksomhet"),
    "F": (("41", "42", "43"), "Bygge- og anleggsvirksomhet"),
    "G": (("45", "46", "47"), "Varehandel, reparasjon av motorvogner"),
    "H": (("49", "50", "51", "52", "53"), "Transport og lagring"),
    "I": (("55", "56"), "Overnattings- og serveringsvirksomhet"),
    "J": (("58", "59", "60", "61", "62", "63"), "Informasjon og kommunikasjon"),
    "K": (("64", "65", "66"), "Finansierings- og forsikringsvirksomhet"),
    "L": (("68",), "Omsetning og drift av fast eiendom"),
    "M": (("69", "70", "71", "72", "73", "74", "75"), "Faglig, vitenskapelig og teknisk tjenesteyting"),
    "N": (("77", "78", "79", "80", "81", "82"), "Forretningsmessig tjenesteyting"),
    "O": (("84",), "Offentlig administrasjon og forsvar"),
    "P": (("85",), "Undervisning"),
    "Q": (("86", "87", "88"), "Helse- og sosialtjenester"),
    "R": (("90", "91", "92", "93"), "Kulturell virksomhet, underholdning og fritidsaktiviteter"),
    "S": (("94", "95", "96"), "Annen tjenesteyting"),
    "T": (("97", "98"), "Lønnet arbeid i private husholdninger"),
    "U": (("99",), "Internasjonale organisasjoner og organer"),
}

# Derived constants - computed once at module load (O(1) access)
NACE_SECTION_RANGES: dict[str, tuple[str, ...]] = {k: v[0] for k, v in _NACE_SECTIONS.items()}

NACE_SECTION_NAMES: dict[str, str] = {k: v[1] for k, v in _NACE_SECTIONS.items()}

# Valid section letters for O(1) membership check
VALID_SECTION_LETTERS: frozenset[str] = frozenset(NACE_SECTION_RANGES.keys())

# Placeholder code for unknown/undefined industry
NACE_UNKNOWN_CODE: str = "00"


def is_nace_section_letter(code: str | None) -> bool:
    """
    Check if a code is a single NACE section letter (A-U).

    Args:
        code: String to check (handles None/empty safely)

    Returns:
        True if code is a valid section letter
    """
    if not code or len(code) != 1:
        return False
    return code.upper() in VALID_SECTION_LETTERS


def get_nace_division_prefixes(section_or_code: str | None) -> list[str]:
    """
    Get numeric division prefixes for a NACE section letter or return code as-is.

    Args:
        section_or_code: Either a section letter (A-U) or a numeric code (62, 62.010)

    Returns:
        List of 2-digit division prefixes to match with LIKE.
        Returns empty list for None/empty input.

    Examples:
        'F' -> ['41', '42', '43']
        'L' -> ['68']
        '62' -> ['62']
        '62.010' -> ['62.010']
        None -> []
        '' -> []
    """
    if not section_or_code:
        return []

    code = section_or_code.strip().upper()

    if not code:
        return []

    if code in VALID_SECTION_LETTERS:
        return list(NACE_SECTION_RANGES[code])

    # Not a section letter, return as-is (preserving original case for numeric codes)
    return [section_or_code.strip()]


def get_nace_section_name(section: str | None) -> str | None:
    """
    Get Norwegian name for a NACE section letter.

    Args:
        section: Section letter (A-U), case-insensitive

    Returns:
        Norwegian name or None if not found
    """
    if not section:
        return None
    return NACE_SECTION_NAMES.get(section.upper())
