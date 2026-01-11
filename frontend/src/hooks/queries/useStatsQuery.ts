import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'

interface Stats {
  total_companies: number
  total_accounting_reports: number
  total_revenue: number
  total_employees: number
  profitable_percentage: number
  avg_operating_margin: number
  new_companies_ytd: number
  bankruptcies: number
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
