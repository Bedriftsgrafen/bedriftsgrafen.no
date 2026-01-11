"""Company repository - main class composed from mixins.

This provides the CompanyRepository class which combines functionality
from specialized mixin modules for cleaner code organization.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from repositories.company.crud import CrudMixin
from repositories.company.lookups import LookupsMixin
from repositories.company.queries import QueryMixin
from repositories.company.search import SearchMixin
from repositories.company.stats import StatsMixin


class CompanyRepository(QueryMixin, StatsMixin, SearchMixin, CrudMixin, LookupsMixin):
    """Repository for company database operations.

    Composed from mixins:
    - QueryMixin: get_all, stream_all, optimized query methods
    - StatsMixin: count_companies, get_aggregate_stats, dashboard stats
    - SearchMixin: Full-text search (search_by_name)
    - CrudMixin: Create/update operations
    - LookupsMixin: Single-entity lookups (get_by_orgnr, get_similar_companies)
    """

    def __init__(self, db: AsyncSession):
        self.db = db
