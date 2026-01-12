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
| **geocoding_batch_service** | ❌ Missing | Low |
| **scheduler** | ❌ Missing | Low |
| ssb_service | ✅ Tested | - |

## Backend Repositories (tests/unit/repositories/)

| Repository | Status | Priority |
|------------|--------|----------|
| company_lookups | ✅ Tested | - |
| company_filter_builder | ✅ Tested | - |
| accounting_repository | ✅ Tested | - |
| **company/queries.py** | ❌ Missing | Medium |
| **company/crud.py** | ❌ Missing | Medium |
| **company/stats.py** | ❌ Missing | Medium |
| **stats_repository** | ❌ Missing | Medium |
| **role_repository** | ❌ Missing | Low |
| **subunit_repository** | ❌ Missing | Low |

## Backend Routers (tests/unit/routers/)

| Router | Status | Priority |
|--------|--------|----------|
| **v1/companies** | ❌ Missing | High |
| **v1/stats** | ❌ Missing | High |
| **v1/trends** | ❌ Missing | Medium |
| **admin_import** | ❌ Missing | Low |
| **sitemap** | ❌ Missing | Low |
| **health** | ❌ Missing | Low |

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
| **themeStore** | ❌ Missing | Low |

## Frontend Hooks (src/hooks/__tests__/)

| Hook | Status | Priority |
|------|--------|----------|
| useFilterParams | ✅ Tested | - |
| useCompanyModal | ✅ Tested | - |
| **useTableState** | ❌ Missing | Medium |
| **usePagination** | ❌ Missing | Low |
| **useNaceName** | ❌ Missing | Low |

## Frontend Components (src/components/__tests__/)

| Component | Status | Priority |
|-----------|--------|----------|
| KpiDashboard | ✅ Tested | - |
| **FilterPanel** | ❌ Missing | High |
| **CompanyList** | ❌ Missing | High |
| **CompanyCard** | ❌ Missing | Medium |
| **StatisticsCards** | ❌ Missing | Medium |

## Frontend Utils (src/utils/__tests__/)

| Util | Status | Priority |
|------|--------|----------|
| formatters | ✅ Tested | - |
| organizationForms | ✅ Tested | - |
| **api.ts** | ❌ Missing | Medium |
| **queryKeys.ts** | ❌ Missing | Low |

---

## Summary

| Area | Tested | Missing | Coverage |
|------|--------|---------|----------|
| Backend Services | 9 | 5 | 64% |
| Backend Repositories | 3 | 6 | 33% |
| Backend Routers | 0 | 6 | 0% |
| Frontend Stores | 4 | 4 | 50% |
| Frontend Hooks | 0 | 5 | 0% |
| Frontend Components | 1 | 4 | 20% |
| Frontend Utils | 2 | 2 | 50% |

**Total: ~35% coverage**

## Next Priority Actions

1. Add router tests for v1/companies and v1/stats
2. Add hook tests for useFilterParams
3. Add component tests for FilterPanel and CompanyList
4. Add service tests for bulk_import_service
