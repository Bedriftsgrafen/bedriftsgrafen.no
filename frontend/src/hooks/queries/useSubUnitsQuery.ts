import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'
import type { SubUnit } from '../../types'

import { companyQueryKeys } from '../../lib/queryKeys'

interface SubUnitsResponse {
  data: SubUnit[]
  total: number
  metadata?: Record<string, unknown>
}

/**
 * Hook for fetching subunits (underenheter/avdelinger) for a company
 * Uses lazy-loading: returns cached DB data if available, otherwise fetches from API
 */
export function useSubUnitsQuery(orgnr: string | undefined) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: companyQueryKeys.subunits(orgnr || ''),
    queryFn: async () => {
      if (!orgnr) return []
      const response = await apiClient.get<SubUnitsResponse>(`/v1/companies/${orgnr}/subunits`)
      return response.data?.data || []
    },
    enabled: !!orgnr,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours (rarely changes)
    gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour
    retry: 1, // Reduce retries to avoid long waits on timeout
    retryDelay: 1000, // Simple 1s delay
  })

  /**
   * Force fetch subunits from Brønnøysundregistrene API.
   * This bypasses cache and triggers actual API call.
   */
  const fetchFromBrreg = async () => {
    if (!orgnr) return

    // Set loading state by invalidating
    await queryClient.invalidateQueries({ queryKey: ['subunits', orgnr] })

    // Fetch with force_refresh=true
    const response = await apiClient.get<SubUnitsResponse>(
      `/v1/companies/${orgnr}/subunits`,
      { params: { force_refresh: true } }
    )

    // Update cache with fresh data
    queryClient.setQueryData(['subunits', orgnr], response.data?.data || [])

    return response.data?.data || []
  }

  return {
    ...query,
    fetchFromBrreg,
  }
}

