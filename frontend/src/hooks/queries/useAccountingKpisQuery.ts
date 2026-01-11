import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'
import { AccountingWithKpis } from '../../types'
import { accountingQueryKeys } from '../../lib/queryKeys'
import axios from 'axios'

/**
 * Create query options for accounting KPIs
 * Note: 404 is expected and normal - most companies don't have accounting data
 * Returns null for missing data (404), which is properly typed.
 */
export function getAccountingKpisQueryOptions(
  orgnr: string,
  year: number
): UseQueryOptions<AccountingWithKpis | null> {
  return {
    queryKey: accountingQueryKeys.kpi(orgnr, year),
    queryFn: async (): Promise<AccountingWithKpis | null> => {
      try {
        const response = await apiClient.get<AccountingWithKpis>(
          `/v1/companies/${orgnr}/accounting/${year}`
        )
        return response.data
      } catch (error) {
        // 404 is expected - most companies don't have accounting data
        // Return null silently instead of throwing
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          return null
        }
        throw error
      }
    },
    staleTime: Infinity, // Accounting data is historical, never changes
    // Only retry on server errors (5xx), not on 404 which is expected
    retry: (failureCount, error) => {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return false // Don't retry 404
      }
      return failureCount < 2 // Retry other errors twice
    },
  }
}

export function useAccountingKpisQuery(orgnr: string | null, year: number | null) {
  return useQuery({
    ...getAccountingKpisQueryOptions(orgnr || '', year || 0),
    enabled: !!orgnr && !!year, // Only run if both orgnr and year are provided
  })
}
