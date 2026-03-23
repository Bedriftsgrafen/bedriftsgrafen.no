---
name: testing_patterns
description: Testing conventions, structure, and patterns for backend (pytest) and frontend (vitest) tests.
---

# Testing Patterns

## Backend (pytest + pytest-asyncio)

### Structure

```
backend/tests/
├── conftest.py          # Shared fixtures, SQLite compat, mock session
├── factories/           # polyfactory data factories (Norwegian locale)
│   ├── company_factory.py
│   ├── accounting_factory.py
│   └── stats_factory.py
├── unit/
│   ├── routers/         # Test HTTP handlers (mock service layer)
│   ├── services/        # Test business logic (mock repositories)
│   ├── repositories/    # Test DB queries (SQLite in-memory)
│   ├── utils/           # Test utilities
│   └── middleware/       # Test middleware (security headers, etc.)
└── integration/         # Tests requiring real DB or multi-layer
```

### Running tests

```bash
# Full suite
backend/.venv/bin/pytest backend

# Specific file (fast feedback)
backend/.venv/bin/pytest backend/tests/unit/services/test_kpi_service.py -x

# With verbose output
backend/.venv/bin/pytest backend -v --tb=short

# Only unit tests
backend/.venv/bin/pytest backend/tests/unit/

# Only integration tests
backend/.venv/bin/pytest backend/tests/integration/
```

### Writing a unit test

Pattern: **AAA** (Arrange, Act, Assert) with mocked dependencies.

```python
import pytest
from unittest.mock import AsyncMock

@pytest.mark.asyncio
async def test_get_company_returns_data(mock_db_session, sample_company_data):
    """Test that get_company returns company when found."""
    # Arrange
    repo = CompanyRepository(mock_db_session)
    mock_db_session.execute.return_value.scalars.return_value.first.return_value = (
        sample_company_data
    )

    # Act
    result = await repo.get_company("123456789")

    # Assert
    assert result is not None
    assert result["orgnr"] == "123456789"
```

### Using factories

Factories create realistic Norwegian test data via `polyfactory` + `Faker("no_NO")`:

```python
from tests.factories.company_factory import CompanyFactory
from tests.factories.accounting_factory import AccountingFactory

def test_kpi_with_factory_data():
    company = CompanyFactory.build()
    accounting = AccountingFactory.build(orgnr=company.orgnr, aar=2023)
    # Use accounting fields for KPI calculations...
```

### Key fixtures (from conftest.py)

- `mock_db_session` — AsyncMock SQLAlchemy session (sync methods like `add()` use MagicMock)
- `sample_company_data` — Dict with standard company fields
- `sample_accounting_data` — Dict with standard accounting fields

### Conventions

- Use `@pytest.mark.asyncio` on all async tests
- Mock at the boundary: mock the repository in service tests, mock the service in router tests
- Never call real external APIs (Brønnøysund) — mock `BrregApiService`
- Test None/null handling — Brønnøysund data often has missing fields
- Use `-x` flag during development to stop on first failure

## Frontend (vitest + @testing-library/react)

### Structure

```
frontend/src/
├── components/<Feature>/__tests__/   # Component tests
├── store/__tests__/                   # Zustand store tests
├── lib/__tests__/                     # Utility tests
```

### Running tests

```bash
cd frontend

# Full suite
npm test

# Watch mode
npm test -- --watch

# Specific file
npm test -- src/store/__tests__/filterStore.test.ts
```

### Writing a component test

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

describe("ComponentName", () => {
  it("renders expected content", () => {
    render(<ComponentName data={mockData} />);
    expect(screen.getByText("Forventet tekst")).toBeInTheDocument();
  });
});
```

### Writing a store test

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useFilterStore } from "../filterStore";

describe("filterStore", () => {
  beforeEach(() => {
    useFilterStore.getState().reset();
  });

  it("updates filters correctly", () => {
    useFilterStore.getState().setFilter("organisasjonsform", "AS");
    expect(useFilterStore.getState().filters.organisasjonsform).toBe("AS");
  });
});
```

### Conventions

- Mock API hooks with `vi.mock("@/hooks/queries/useCompanyQuery")`
- Test user-visible behavior, not implementation details
- All test text assertions use Norwegian (matching UI)
- Use `screen.getByRole` over `getByTestId` when possible

## When to write tests

- **Always**: New services, repositories, routers, KPI calculations
- **Always**: Bug fixes (write a test that reproduces the bug first)
- **Always**: Zustand stores (pure logic, easy to test)
- **Recommended**: Complex components with conditional rendering
- **Skip**: Simple pass-through components, pure layout components
