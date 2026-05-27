import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'

export interface Stats {
  total_companies: number | null
  total_accounting_reports: number | null
  total_revenue: number | null
  total_ebitda: number | null
  total_employees: number | null
  profitable_percentage: number | null
  solid_company_percentage: number | null
  avg_operating_margin: number | null
  new_companies_ytd: number | null
  new_companies_30d: number | null
  bankruptcies: number | null
  geocoded_count: number | null
  total_roles: number | null
  avg_board_age: number | null
}

const EMPTY_STATS: Stats = {
  total_companies: null,
  total_accounting_reports: null,
  total_revenue: null,
  total_ebitda: null,
  total_employees: null,
  profitable_percentage: null,
  solid_company_percentage: null,
  avg_operating_margin: null,
  new_companies_ytd: null,
  new_companies_30d: null,
  bankruptcies: null,
  geocoded_count: null,
  total_roles: null,
  avg_board_age: null,
}

function isStatsRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readNumber(data: Record<string, unknown>, ...keys: string[]): number | null {
  for (const key of keys) {
    const value = data[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return null
}

export function normalizeStatsResponse(rawData: unknown): Stats {
  const data = isStatsRecord(rawData) ? rawData : {}

  return {
    total_companies: readNumber(data, 'total_companies', 'total_count'),
    total_accounting_reports: readNumber(data, 'total_accounting_reports', 'accounting_reports'),
    total_revenue: readNumber(data, 'total_revenue'),
    total_ebitda: readNumber(data, 'total_ebitda'),
    total_employees: readNumber(data, 'total_employees'),
    profitable_percentage: readNumber(data, 'profitable_percentage'),
    solid_company_percentage: readNumber(data, 'solid_company_percentage'),
    avg_operating_margin: readNumber(data, 'avg_operating_margin'),
    new_companies_ytd: readNumber(data, 'new_companies_ytd'),
    new_companies_30d: readNumber(data, 'new_companies_30d'),
    bankruptcies: readNumber(data, 'bankruptcies'),
    geocoded_count: readNumber(data, 'geocoded_count'),
    total_roles: readNumber(data, 'total_roles'),
    avg_board_age: readNumber(data, 'avg_board_age'),
  }
}

export function useStatsQuery() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      try {
        const response = await apiClient.get<unknown>('/stats')
        return normalizeStatsResponse(response.data)
      } catch {
        return EMPTY_STATS
      }
    },
    meta: { showErrorToast: false },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })
}
