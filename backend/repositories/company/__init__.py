"""Company repository package - modular mixin-based architecture.

This package provides the CompanyRepository class for database operations.
The implementation is split across modules for clarity:
- base.py: Shared constants, imports, and classes
- queries.py: Query methods (get_all, stream_all)
- stats.py: Count and statistics methods
- lookups.py: Single entity lookups
- search.py: Full-text search
- crud.py: Create/update operations
"""

from repositories.company.base import CompanyWithFinancials
from repositories.company.repository import CompanyRepository

__all__ = ["CompanyRepository", "CompanyWithFinancials"]
