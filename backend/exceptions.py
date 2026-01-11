"""Custom exceptions for Bedriftsgrafen.

This module defines domain-specific exceptions that provide better error handling
and debugging compared to generic HTTP exceptions.
"""


class BedriftsgrafenException(Exception):
    """Base exception for all domain errors"""

    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class CompanyNotFoundException(BedriftsgrafenException):
    """Company not found in database"""

    def __init__(self, orgnr: str):
        super().__init__(f"Company with orgnr {orgnr} not found", status_code=404)
        self.orgnr = orgnr


class AccountingNotFoundException(BedriftsgrafenException):
    """Accounting data not found"""

    def __init__(self, orgnr: str, year: int):
        super().__init__(f"Accounting data for {orgnr} in year {year} not found", status_code=404)
        self.orgnr = orgnr
        self.year = year


class BrregApiException(BedriftsgrafenException):
    """External API error from Brønnøysundregistrene"""

    def __init__(self, message: str, details: str = ""):
        full_message = f"Brønnøysund API error: {message}"
        if details:
            full_message += f" - {details}"
        super().__init__(full_message, status_code=502)
        self.details = details


class ValidationException(BedriftsgrafenException):
    """Business logic validation error"""

    def __init__(self, message: str):
        super().__init__(message, status_code=400)


class DatabaseException(BedriftsgrafenException):
    """Database operation error"""

    def __init__(self, message: str, original_error: Exception | None = None):
        super().__init__(f"Database error: {message}", status_code=500)
        self.original_error = original_error


class RateLimitException(BedriftsgrafenException):
    """Rate limit exceeded for external API"""

    def __init__(self, message: str = "Rate limit exceeded. Please try again later."):
        super().__init__(message, status_code=429)


class InvalidOrgnrException(ValidationException):
    """Invalid organization number format"""

    def __init__(self, orgnr: str):
        super().__init__(f"Invalid organization number format: {orgnr}. Expected 9 digits.")
        self.orgnr = orgnr
