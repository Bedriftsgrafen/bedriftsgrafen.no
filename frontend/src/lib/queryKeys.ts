/**
 * Query key factory for TanStack Query
 * Centralized to ensure consistency across app
 */

export const companyQueryKeys = {
  all: ['companies'] as const,
  lists: () => [...companyQueryKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [
    ...companyQueryKeys.lists(),
    { filters },
  ] as const,
  details: () => [...companyQueryKeys.all, 'detail'] as const,
  detail: (orgnr: string) => [...companyQueryKeys.details(), orgnr] as const,
  count: (filters?: Record<string, unknown>) => [
    ...companyQueryKeys.all,
    'count',
    { filters },
  ] as const,
}

export const accountingQueryKeys = {
  all: ['accounting'] as const,
  details: () => [...accountingQueryKeys.all, 'detail'] as const,
  detail: (orgnr: string, year: number | null) => [
    ...accountingQueryKeys.details(),
    orgnr,
    year,
  ] as const,
  kpis: () => [...accountingQueryKeys.all, 'kpi'] as const,
  kpi: (orgnr: string, year: number | null) => [
    ...accountingQueryKeys.kpis(),
    orgnr,
    year,
  ] as const,
}
