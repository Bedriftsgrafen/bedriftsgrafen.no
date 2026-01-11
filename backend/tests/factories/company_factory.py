"""
Factory for creating test Company instances.

Uses polyfactory with Norwegian locale for realistic test data.
"""

from dataclasses import dataclass
from datetime import date
from typing import Any

from faker import Faker
from polyfactory.factories import DataclassFactory
from polyfactory.fields import Use

fake = Faker("no_NO")  # Norwegian locale


@dataclass
class CompanyData:
    """
    Data class mirroring the Company model structure for testing.
    Using dataclass instead of SQLAlchemy model for simpler unit testing.
    """

    orgnr: str
    navn: str
    organisasjonsform: str = "AS"
    naeringskode: str | None = "62.010"
    antall_ansatte: int | None = None
    stiftelsesdato: date | None = None
    konkurs: bool = False
    under_avvikling: bool = False
    under_tvangsavvikling: bool = False
    hjemmeside: str | None = None
    data: dict[str, Any] | None = None
    raw_data: dict[str, Any] | None = None
    postadresse: dict[str, Any] | None = None
    forretningsadresse: dict[str, Any] | None = None


class CompanyFactory(DataclassFactory[CompanyData]):
    """Factory for creating test Company instances."""

    __model__ = CompanyData

    orgnr = Use(lambda: fake.numerify(text="#########"))
    navn = Use(lambda: fake.company())
    organisasjonsform = Use(lambda: fake.random_element(["AS", "ASA", "NUF", "ENK", "ANS"]))
    naeringskode = Use(
        lambda: fake.random_element(
            [
                "62.010",  # Programmeringstjenester
                "47.110",  # Butikkhandel
                "68.100",  # Kjøp/salg av eiendom
                "70.220",  # Bedriftsrådgivning
                "41.200",  # Oppføring av bygninger
            ]
        )
    )
    antall_ansatte = Use(lambda: fake.random_int(min=1, max=500))
    stiftelsesdato = Use(lambda: fake.date_between(start_date=date(1995, 1, 1)))
    konkurs = False
    under_avvikling = False
    under_tvangsavvikling = False

    @classmethod
    def bankrupt(cls, **kwargs) -> CompanyData:
        """Create a bankrupt company."""
        return cls.build(konkurs=True, **kwargs)

    @classmethod
    def inactive(cls, **kwargs) -> CompanyData:
        """Create an inactive company (under avvikling)."""
        return cls.build(under_avvikling=True, **kwargs)
