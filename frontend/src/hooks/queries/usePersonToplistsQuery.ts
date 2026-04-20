import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'
import type { PersonToplistResponse } from '../../types/person'
import { personQueryKeys } from './usePersonSearchQuery'

/**
 * Fetches all toplist categories in one API call.
 * Frontend filters by category client-side.
 */
export function usePersonToplistsQuery(limit: number = 10) {
    return useQuery({
        queryKey: personQueryKeys.toplists(limit),
        queryFn: async (): Promise<PersonToplistResponse[]> => {
            const response = await apiClient.get<PersonToplistResponse[]>(
                '/v1/people/toplists',
                { params: { limit } }
            )
            return response.data
        },
        staleTime: 1000 * 60 * 30,
        gcTime: 1000 * 60 * 60,
    })
}
