import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'
import type { PersonAggregateStats } from '../../types/person'
import { personQueryKeys } from './usePersonSearchQuery'

/**
 * Fetches aggregate person statistics for the landing page.
 */
export function usePersonStatsQuery() {
    return useQuery({
        queryKey: personQueryKeys.stats(),
        queryFn: async (): Promise<PersonAggregateStats> => {
            const response = await apiClient.get<PersonAggregateStats>(
                '/v1/people/stats'
            )
            return response.data
        },
        staleTime: 1000 * 60 * 30,
        gcTime: 1000 * 60 * 60,
    })
}
