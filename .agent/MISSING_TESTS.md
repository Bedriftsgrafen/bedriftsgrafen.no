# Missing Test Coverage

## Backend Services (tests/unit/services/)

| Service | Status | Priority |
|---------|--------|----------|
| kpi_service | ✅ Tested | - |
| company_service | ✅ Tested | - |
| geocoding_service | ✅ Tested | - |
| nace_service | ✅ Tested | - |
| role_service | ✅ Tested | - |
| benchmark | ✅ Tested | - |
| export_service | ✅ Tested | - |
| stats_service | ✅ Tested | - |
| brreg_api_service | ✅ Tested | - |
| bulk_import_service | ✅ Tested | - |
| update_service | ✅ Tested | - |
| geocoding_batch_service | ✅ Tested | - |
| scheduler | ✅ Tested | - |
| ssb_service | ✅ Tested | - |

## Backend Repositories (tests/unit/repositories/)

| Repository | Status | Priority |
|------------|--------|----------|
| company_lookups | ✅ Tested | - |
| company_filter_builder | ✅ Tested | - |
| accounting_repository | ✅ Tested | - |
| company/queries.py | ✅ Tested | - |
| company/crud.py | ✅ Tested | - |
| company/stats.py | ✅ Tested | - |
| stats_repository | ✅ Tested | - |
| system_repository | ✅ Tested | - |
| role_repository | ✅ Tested | - |
| subunit_repository | ✅ Tested | - |

## Backend Routers (tests/unit/routers/)

| Router | Status | Priority |
|--------|--------|----------|
| v1/companies | ✅ Tested | - |
| v1/stats | ✅ Tested | - |
| v1/trends | ✅ Tested | - |
| admin_import | ✅ Tested | - |
| sitemap | ✅ Tested | - |
| health | ✅ Tested | - |

---

## Frontend Stores (src/store/__tests__/)

| Store | Status | Priority |
|-------|--------|----------|
| filterStore | ✅ Tested | - |
| uiStore | ✅ Tested | - |
| comparisonStore | ✅ Tested | - |
| favoritesStore | ✅ Tested | - |
| savedFiltersStore | ✅ Tested | - |
| explorerStore | ✅ Tested | - |
| toastStore | ✅ Tested | - |
| themeStore | ✅ Tested | - |

## Frontend Hooks (src/hooks/__tests__/)

| Hook | Status | Priority |
|------|--------|----------|
| useFilterParams | ✅ Tested | - |
| useCompanyModal | ✅ Tested | - |
| useTableState | ✅ Tested | - |
| usePagination | ✅ Tested | - |
| useNaceName | ✅ Tested | - |

## Frontend Components (src/components/__tests__/)

| Component | Status | Priority |
|-----------|--------|----------|
| KpiDashboard | ✅ Tested | - |
| FilterPanel | ✅ Tested | - |
| CompanyList | ✅ Tested | - |
| CompanyCard | ✅ Tested | - |
| StatisticsCards | ✅ Tested | - |

## Frontend Utils (src/utils/__tests__/)

| Util | Status | Priority |
|------|--------|----------|
| formatters | ✅ Tested | - |
| organizationForms | ✅ Tested | - |
| api.ts | ✅ Tested | - |
| queryKeys.ts | ✅ Tested | - |
| chartTransformers | ✅ Tested | - |
| accountingHelpers | ✅ Tested | - |
| dates | ✅ Tested | - |
| nace | ✅ Tested | - |
| postalCoordinates | ✅ Tested | - |
| analytics | ✅ Tested | - |
| clipboard | ✅ Tested | - |
| abTesting | ✅ Tested | - |

---

## Summary

| Area | Tested | Missing | Coverage |
|------|--------|---------|----------|
| Backend Services | 14 | 0 | 100% |
| Backend Repositories | 10 | 0 | 100% |
| Backend Routers | 6 | 0 | 100% |
| Frontend Stores | 8 | 0 | 100% |
| Frontend Hooks | 5 | 0 | 100% |
| Frontend Components | 5 | 0 | 100% |
| Frontend Utils | 12 | 0 | 100% |

**Total: 100% unit test coverage for logic-critical paths.**

## Next Priority Actions

All identified high, medium, and low priority missing tests have been implemented!
Future work can focus on E2E testing using Playwright/Cypress to verify complex user flows.
