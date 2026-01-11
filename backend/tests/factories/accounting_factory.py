"""
Factory for creating test Accounting instances.

Uses polyfactory with realistic Norwegian financial data.
"""

from dataclasses import dataclass
from datetime import date
from typing import Any

from faker import Faker
from polyfactory.factories import DataclassFactory
from polyfactory.fields import Use

fake = Faker("no_NO")


@dataclass
class AccountingData:
    """
    Data class mirroring the Accounting model structure for testing.
    Using dataclass instead of SQLAlchemy model for simpler unit testing.
    """

    id: int = 1
    orgnr: str = "123456789"
    aar: int = 2023
    periode_fra: date | None = None
    periode_til: date | None = None
    total_inntekt: float | None = None
    aarsresultat: float | None = None
    egenkapital: float | None = None
    gjeldsgrad: float | None = None
    driftsresultat: float | None = None
    salgsinntekter: float | None = None
    omloepsmidler: float | None = None
    kortsiktig_gjeld: float | None = None
    avskrivninger: float | None = None
    anleggsmidler: float | None = None
    langsiktig_gjeld: float | None = None
    raw_data: dict[str, Any] | None = None


class AccountingFactory(DataclassFactory[AccountingData]):
    """Factory for creating test Accounting instances."""

    __model__ = AccountingData

    id = Use(lambda: fake.random_int(min=1, max=100000))
    orgnr = Use(lambda: fake.numerify(text="#########"))
    aar = Use(lambda: fake.random_int(min=2018, max=2024))
    total_inntekt = Use(lambda: fake.random_int(min=100000, max=100000000))
    aarsresultat = Use(lambda: fake.random_int(min=-1000000, max=10000000))
    egenkapital = Use(lambda: fake.random_int(min=100000, max=50000000))
    driftsresultat = Use(lambda: fake.random_int(min=-500000, max=5000000))
    salgsinntekter = Use(lambda: fake.random_int(min=100000, max=100000000))
    omloepsmidler = Use(lambda: fake.random_int(min=100000, max=30000000))
    kortsiktig_gjeld = Use(lambda: fake.random_int(min=50000, max=15000000))
    avskrivninger = Use(lambda: fake.random_int(min=10000, max=2000000))
    anleggsmidler = Use(lambda: fake.random_int(min=100000, max=50000000))
    langsiktig_gjeld = Use(lambda: fake.random_int(min=0, max=30000000))

    @classmethod
    def profitable(cls, **kwargs) -> AccountingData:
        """Create a profitable company with good KPIs."""
        return cls.build(
            salgsinntekter=10000000,
            driftsresultat=2000000,
            aarsresultat=1500000,
            avskrivninger=500000,
            egenkapital=5000000,
            omloepsmidler=4000000,
            kortsiktig_gjeld=1000000,
            anleggsmidler=3000000,
            langsiktig_gjeld=1000000,
            **kwargs,
        )

    @classmethod
    def loss_making(cls, **kwargs) -> AccountingData:
        """Create a loss-making company."""
        return cls.build(
            salgsinntekter=5000000,
            driftsresultat=-500000,
            aarsresultat=-800000,
            avskrivninger=200000,
            egenkapital=1000000,
            omloepsmidler=500000,
            kortsiktig_gjeld=2000000,
            anleggsmidler=1500000,
            langsiktig_gjeld=1000000,
            **kwargs,
        )

    @classmethod
    def with_zero_kortsiktig_gjeld(cls, **kwargs) -> AccountingData:
        """Create accounting data with zero short-term debt (edge case for KPI calculations)."""
        return cls.build(kortsiktig_gjeld=0, **kwargs)

    @classmethod
    def with_negative_egenkapital(cls, **kwargs) -> AccountingData:
        """Create accounting data with negative equity (edge case)."""
        return cls.build(egenkapital=-500000, **kwargs)
