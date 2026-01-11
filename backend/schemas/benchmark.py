"""Benchmark-related Pydantic schemas for API request/response models."""

from pydantic import BaseModel, Field, field_validator


class BenchmarkMetric(BaseModel):
    """A single metric comparison between company and industry."""

    company_value: float | None = Field(None, description="Company's value for this metric")
    industry_avg: float | None = Field(None, description="Industry average")
    industry_median: float | None = Field(None, description="Industry median (if available)")
    percentile: int | None = Field(
        None, ge=0, le=100, description="Company's percentile rank in industry (0-100)"
    )


class IndustryBenchmarkResponse(BaseModel):
    """Benchmark comparison of a company against its industry."""

    orgnr: str = Field(..., description="Company organization number")
    nace_code: str = Field(..., description="NACE code used (2 or 5 digits)")
    nace_division: str = Field(..., description="NACE division code (2 digits)")
    nace_name: str | None = Field(None, description="NACE name")
    municipality_code: str | None = Field(None, description="Municipality code if local comparison, None for national")
    company_count: int = Field(..., description="Number of companies in industry")

    # Metric comparisons
    revenue: BenchmarkMetric = Field(..., description="Revenue comparison (salgsinntekter)")
    profit: BenchmarkMetric = Field(..., description="Profit comparison (aarsresultat)")
    employees: BenchmarkMetric = Field(..., description="Employee count comparison")
    operating_margin: BenchmarkMetric = Field(..., description="Operating margin comparison")

    @field_validator("nace_code")
    @classmethod
    def validate_nace_code(cls, v: str) -> str:
        """Validate NACE code format: 2 digits (XX) or 5 digits with dot (XX.XXX)."""
        if len(v) == 2:
            if not v.isdigit():
                raise ValueError("2-digit NACE code must be numeric (e.g., '62')")
        elif len(v) == 6:
            # Format: XX.XXX
            if v[2] != "." or not v[:2].isdigit() or not v[3:].isdigit():
                raise ValueError("5-digit NACE code must follow format XX.XXX (e.g., '62.010')")
        else:
            raise ValueError("NACE code must be 2 digits (XX) or 6 characters (XX.XXX)")
        return v

    class Config:
        from_attributes = True
