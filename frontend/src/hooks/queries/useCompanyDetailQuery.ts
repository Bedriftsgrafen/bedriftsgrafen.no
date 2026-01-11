import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'
import { CompanyWithAccounting } from '../../types'
import { useEffect } from 'react'
import { companyQueryKeys } from '../../lib/queryKeys'

interface FetchCompanyResponse {
  company_fetched: boolean
  financials_fetched: number
  errors: string[]
}

/**
 * Create query options for company detail
 * Can be used with useQuery hook or in route loaders
 */
export function getCompanyDetailQueryOptions(
  orgnr: string
): UseQueryOptions<CompanyWithAccounting> {
  return {
    queryKey: companyQueryKeys.detail(orgnr),
    queryFn: async () => {
      const response = await apiClient.get<CompanyWithAccounting>(
        `/v1/companies/${orgnr}`
      )
      return response.data
    },
    staleTime: 10 * 60 * 1000, // 10 minutes for company details
    retry: 3,
    retryDelay: (attemptIndex) =>
      Math.min(1000 * 2 ** attemptIndex, 30000),
  }
}

export function useCompanyDetailQuery(orgnr: string | null, autoFetch: boolean = true) {
  const queryClient = useQueryClient()

  const query = useQuery({
    ...getCompanyDetailQueryOptions(orgnr || ''),
    enabled: !!orgnr, // Only run query if orgnr is provided
  })

  // Auto-fetch from Brønnøysund if company has no accounting data
  useEffect(() => {
    if (autoFetch && query.data && query.data.regnskap.length === 0 && orgnr) {
      // Only auto-fetch once per session (check if we already tried)
      const autoFetchKey = `auto-fetched-${orgnr}`
      const alreadyFetched = sessionStorage.getItem(autoFetchKey)

      if (!alreadyFetched) {
        sessionStorage.setItem(autoFetchKey, 'true')

        // Fetch in background
        apiClient.post<FetchCompanyResponse>(`/v1/companies/${orgnr}/fetch`, {
          fetch_financials: true
        })
          .then(() => {
            // Invalidate query to refetch with new data
            queryClient.invalidateQueries({ queryKey: companyQueryKeys.detail(orgnr) })
          })
          .catch((error: unknown) => {
            console.error('Auto-fetch failed:', error)
          })
      }
    }
  }, [query.data, orgnr, autoFetch, queryClient])

  return query
}
