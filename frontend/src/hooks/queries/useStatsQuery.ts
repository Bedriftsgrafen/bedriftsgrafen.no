import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'

export interface Stats {
  total_companies: number
  total_accounting_reports: number
  total_revenue: number
  total_ebitda: number
  total_employees: number
  profitable_percentage: number
  solid_company_percentage: number
  avg_operating_margin: number
  new_companies_ytd: number
  new_companies_30d: number
  bankruptcies: number
  geocoded_count: number
  total_roles: number
  avg_board_age: number
}

export function useStatsQuery() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const response = await apiClient.get<Stats>('/stats')
      return response.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })
}
