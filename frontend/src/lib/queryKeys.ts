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
  events: (orgnr: string, limit: number, offset: number) => [
    ...companyQueryKeys.detail(orgnr),
    'events',
    { limit, offset },
  ] as const,
  count: (filters?: Record<string, unknown>) => [
    ...companyQueryKeys.all,
    'count',
    { filters },
  ] as const,
  subunits: (orgnr: string) => [...companyQueryKeys.all, 'subunits', orgnr] as const,
  markers: (nace: string | null, county?: string | null, region?: string | null) => [
    ...companyQueryKeys.all,
    'markers',
    { nace, county, region },
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
  kpiById: (orgnr: string, accountingId: number | null) => [
    ...accountingQueryKeys.kpis(),
    'byId',
    orgnr,
    accountingId,
  ] as const,
}

export const municipalityQueryKeys = {
  all: ['municipalities'] as const,
  lists: () => [...municipalityQueryKeys.all, 'list'] as const,
  dashboards: () => [...municipalityQueryKeys.all, 'dashboard'] as const,
  dashboard: (code: string) => [...municipalityQueryKeys.dashboards(), code] as const,
}

export const countyQueryKeys = {
  all: ['counties'] as const,
  lists: () => [...countyQueryKeys.all, 'list'] as const,
  dashboards: () => [...countyQueryKeys.all, 'dashboard'] as const,
  dashboard: (code: string) => [...countyQueryKeys.dashboards(), code] as const,
}

export const industryQueryKeys = {
  all: ['industries'] as const,
  dashboards: () => [...industryQueryKeys.all, 'dashboard'] as const,
  dashboard: (code: string) => [...industryQueryKeys.dashboards(), code] as const,
}
