"""
Unit tests for CompanyFilterBuilder.
Tests the translation of FilterParams into SQLAlchemy clauses.
"""

from datetime import date

from sqlalchemy.sql.elements import BinaryExpression, BooleanClauseList

from models import Company, LatestFinancials
from repositories.company_filter_builder import CompanyFilterBuilder, FilterParams


class TestCompanyFilterBuilder:
    def _compile_clause(self, clause):
        """Helper to compile a clause to a string for assertion (approximate)."""
        # Note: Exact string matching SQL is brittle due to bind params.
        # Ideally we inspect the expression structure.
        return str(clause)

    def test_init_empty(self):
        filters = FilterParams()
        builder = CompanyFilterBuilder(filters)
        assert len(builder.clauses) == 0
        assert builder.needs_financial_join is False

    def test_apply_text_search_digit(self):
        filters = FilterParams(name="123456789")
        builder = CompanyFilterBuilder(filters)
        builder.apply_text_search()
        assert len(builder.clauses) == 1
        # Should use LIKE '123456789%'
        expr = builder.clauses[0]
        assert isinstance(expr, BinaryExpression)
        assert expr.left == Company.orgnr
        assert expr.right.value == "123456789%"

    def test_apply_text_search_short_name(self):
        filters = FilterParams(name="AB")
        builder = CompanyFilterBuilder(filters)
        builder.apply_text_search()
        assert len(builder.clauses) == 1
        # Should use ILIKE 'AB%'
        expr = builder.clauses[0]
        assert isinstance(expr, BinaryExpression)
        assert expr.left == Company.navn
        assert expr.right.value == "AB%"

    def test_apply_text_search_full_text(self):
        filters = FilterParams(name="Example Company")
        builder = CompanyFilterBuilder(filters)
        builder.apply_text_search()
        assert len(builder.clauses) == 1
        # Should use websearch_to_tsquery @@ search_vector
        expr = builder.clauses[0]
        assert isinstance(expr, BinaryExpression)
        assert expr.left == Company.search_vector
        # The right side is a function call, harder to inspect deeply without a session
        # but we confirm structure is correct.

    def test_apply_org_form_filter(self):
        filters = FilterParams(organisasjonsform=["AS", "ENK"])
        builder = CompanyFilterBuilder(filters)
        builder.apply_org_form_filter()
        assert len(builder.clauses) == 1
        expr = builder.clauses[0]
        assert isinstance(expr, BinaryExpression)
        assert expr.left == Company.organisasjonsform
        # IN clause inspection
        assert expr.right.value == ["AS", "ENK"]

    def test_apply_exclude_org_form_filter(self):
        filters = FilterParams(exclude_org_form=["KBO"])
        builder = CompanyFilterBuilder(filters)
        builder.apply_exclude_org_form_filter()
        assert len(builder.clauses) == 1
        expr = builder.clauses[0]
        # NOT IN is typically a UnaryExpression(BinaryExpression)
        # or BinaryExpression with operator NOT IN.
        # SQLAlchemy 1.4/2.0 specific structure check:
        # It's usually NOT (col IN (...))
        assert "bedrifter.organisasjonsform NOT IN" in str(expr)

    def test_apply_nace_filter_simple(self):
        filters = FilterParams(naeringskode="62.010")
        builder = CompanyFilterBuilder(filters)
        builder.apply_nace_filter()
        assert len(builder.clauses) == 1
        expr = builder.clauses[0]
        assert expr.left == Company.naeringskode
        assert expr.right.value == "62.010%"

    def test_apply_employee_filter(self):
        filters = FilterParams(min_employees=10, max_employees=50)
        builder = CompanyFilterBuilder(filters)
        builder.apply_employee_filter()
        assert len(builder.clauses) == 2
        # Verify min
        assert builder.clauses[0].left == Company.antall_ansatte
        assert builder.clauses[0].right.value == 10
        # Verify max
        assert builder.clauses[1].left == Company.antall_ansatte
        assert builder.clauses[1].right.value == 50

    def test_apply_location_filter(self):
        filters = FilterParams(municipality="Oslo", county="03")
        builder = CompanyFilterBuilder(filters)
        builder.apply_location_filter()
        assert len(builder.clauses) == 2
        # Municipality OR structure
        muni_clause = builder.clauses[0]
        assert isinstance(muni_clause, BooleanClauseList)
        assert len(muni_clause.clauses) == 2  # forretningsadresse OR postadresse

        # County OR structure
        county_clause = builder.clauses[1]
        assert isinstance(county_clause, BooleanClauseList)
        # Should check left 2 chars

    def test_apply_date_filters(self):
        d1 = date(2020, 1, 1)
        d2 = date(2023, 1, 1)
        filters = FilterParams(founded_from=d1, bankrupt_to=d2)
        builder = CompanyFilterBuilder(filters)
        builder.apply_date_filters()
        assert len(builder.clauses) == 2

        assert builder.clauses[0].left == Company.stiftelsesdato
        assert builder.clauses[0].right.value == d1

        assert builder.clauses[1].left == Company.konkursdato
        assert builder.clauses[1].right.value == d2

    def test_apply_status_filters_bankrupt(self):
        # Case 1: is_bankrupt=True
        filters = FilterParams(is_bankrupt=True)
        builder = CompanyFilterBuilder(filters)
        builder.apply_status_filters()

        clause = builder.clauses[0]
        assert isinstance(clause, BooleanClauseList)
        # OR(konkurs=True, orgform='KBO')
        assert len(clause.clauses) == 2

    def test_apply_status_filters_active(self):
        # Case 2: is_bankrupt=False
        filters = FilterParams(is_bankrupt=False)
        builder = CompanyFilterBuilder(filters)
        builder.apply_status_filters()

        clause = builder.clauses[0]
        assert isinstance(clause, BooleanClauseList)
        # AND(konkurs!=True, orgform!='KBO')

    def test_apply_has_accounting_filter(self):
        filters = FilterParams(has_accounting=True)
        builder = CompanyFilterBuilder(filters)
        builder.apply_has_accounting_filter()

        assert len(builder.clauses) == 1
        # EXISTS(SELECT ...)
        assert "EXISTS" in str(builder.clauses[0])

    def test_apply_financial_filters(self):
        filters = FilterParams(min_revenue=1000000, max_liquidity_ratio=2.0)
        builder = CompanyFilterBuilder(filters)
        builder.apply_financial_filters()

        assert builder.needs_financial_join is True
        assert len(builder.clauses) == 2

        # Check specific columns used
        # Note: This verifies the Fix "Likviditetsgrad1" is working in the builder
        rev_clause = builder.clauses[0]
        assert rev_clause.left == LatestFinancials.salgsinntekter

        liq_clause = builder.clauses[1]
        assert liq_clause.left == LatestFinancials.likviditetsgrad1  # Critical check

    def test_apply_all(self):
        filters = FilterParams(name="Test", min_revenue=1000000)
        # syntax error in test above (1M), python needs 1000000. Correcting in implementation.
        filters = FilterParams(name="Test", min_revenue=1000000)

        builder = CompanyFilterBuilder(filters)
        builder.apply_all(include_financial=True)

        # Name (1) + Revenue (1) = 2 clauses
        assert len(builder.clauses) == 2
        assert builder.needs_financial_join is True
