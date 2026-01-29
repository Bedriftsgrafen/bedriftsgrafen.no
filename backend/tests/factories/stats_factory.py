"""
Factory for creating test Stats model instances.

Uses polyfactory for generating realistic test data for materialized view models.
"""

from dataclasses import dataclass

from faker import Faker
from polyfactory.factories import DataclassFactory
from polyfactory.fields import Use

fake = Faker("no_NO")


@dataclass
class IndustryStatsData:
    """Data class mirroring IndustryStats model for testing."""

    nace_division: str
    company_count: int | None = None
    total_employees: int | None = None
    new_last_year: int | None = None
    bankrupt_count: int | None = None
    bankruptcies_last_year: int | None = None
    total_revenue: float | None = None
    avg_revenue: float | None = None
    total_profit: float | None = None
    avg_profit: float | None = None
    median_revenue: float | None = None
    profitable_count: int | None = None
    avg_operating_margin: float | None = None


class IndustryStatsFactory(DataclassFactory[IndustryStatsData]):
    """Factory for creating test IndustryStats instances."""

    __model__ = IndustryStatsData

    nace_division = Use(lambda: fake.random_element(["01", "02", "41", "47", "62", "68", "70"]))
    company_count = Use(lambda: fake.random_int(min=100, max=50000))
    total_employees = Use(lambda: fake.random_int(min=500, max=200000))
    new_last_year = Use(lambda: fake.random_int(min=10, max=5000))
    bankrupt_count = Use(lambda: fake.random_int(min=0, max=500))
    bankruptcies_last_year = Use(lambda: fake.random_int(min=0, max=100))
    total_revenue = Use(lambda: float(fake.random_int(min=1_000_000, max=100_000_000_000)))
    avg_revenue = Use(lambda: float(fake.random_int(min=500_000, max=50_000_000)))
    total_profit = Use(lambda: float(fake.random_int(min=100_000, max=10_000_000_000)))
    avg_profit = Use(lambda: float(fake.random_int(min=50_000, max=5_000_000)))
    median_revenue = Use(lambda: float(fake.random_int(min=1_000_000, max=10_000_000)))
    profitable_count = Use(lambda: fake.random_int(min=50, max=40000))
    avg_operating_margin = Use(lambda: fake.pyfloat(min_value=-0.5, max_value=0.5))


@dataclass
class CountyStatsData:
    """Data class mirroring CountyStats model for testing."""

    county_code: str
    nace_division: str
    company_count: int | None = None
    new_last_year: int | None = None
    bankrupt_count: int | None = None
    total_employees: int | None = None


class CountyStatsFactory(DataclassFactory[CountyStatsData]):
    """Factory for creating test CountyStats instances."""

    __model__ = CountyStatsData

    county_code = Use(lambda: fake.random_element(["03", "11", "15", "18", "30", "34", "38", "42", "46", "50", "54"]))
    nace_division = Use(lambda: fake.random_element(["01", "41", "47", "62", "68"]))
    company_count = Use(lambda: fake.random_int(min=10, max=5000))
    new_last_year = Use(lambda: fake.random_int(min=1, max=500))
    bankrupt_count = Use(lambda: fake.random_int(min=0, max=50))
    total_employees = Use(lambda: fake.random_int(min=50, max=20000))


@dataclass
class MunicipalityStatsData:
    """Data class mirroring MunicipalityStats model for testing."""

    municipality_code: str
    nace_division: str
    company_count: int | None = None
    new_last_year: int | None = None
    bankrupt_count: int | None = None
    total_employees: int | None = None
    total_revenue: float | None = None


class MunicipalityStatsFactory(DataclassFactory[MunicipalityStatsData]):
    """Factory for creating test MunicipalityStats instances."""

    __model__ = MunicipalityStatsData

    municipality_code = Use(lambda: fake.random_element(["0301", "1101", "4601", "5001", "3001", "3401", "3801"]))
    nace_division = Use(lambda: fake.random_element(["01", "41", "47", "62", "68"]))
    company_count = Use(lambda: fake.random_int(min=5, max=1000))
    new_last_year = Use(lambda: fake.random_int(min=0, max=100))
    bankrupt_count = Use(lambda: fake.random_int(min=0, max=20))
    total_employees = Use(lambda: fake.random_int(min=20, max=5000))
    total_revenue = Use(lambda: float(fake.random_int(min=100_000, max=10_000_000_000)))


@dataclass
class MunicipalityPopulationData:
    """Data class mirroring MunicipalityPopulation model for testing."""

    municipality_code: str
    year: int
    population: int
    name: str | None = None


class MunicipalityPopulationFactory(DataclassFactory[MunicipalityPopulationData]):
    """Factory for creating test MunicipalityPopulation instances."""

    __model__ = MunicipalityPopulationData

    municipality_code = Use(lambda: fake.random_element(["0301", "1101", "4601", "5001", "3001", "3401", "3801"]))
    year = Use(lambda: fake.random_int(min=2020, max=2025))
    population = Use(lambda: fake.random_int(min=1000, max=700000))
    name = Use(lambda: fake.city())
