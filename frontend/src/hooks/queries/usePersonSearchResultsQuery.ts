import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'
import { personQueryKeys } from './usePersonSearchQuery'
import type { PaginatedPersonSearch } from '../../types/person'

/**
 * Hook for the paginated person search results page.
 *
 * Returns enriched results with active/total role counts,
 * top role types, and notable company names.
 */
export function usePersonSearchResultsQuery(query: string, offset: number = 0, limit: number = 20) {
    return useQuery({
        queryKey: personQueryKeys.searchResults(query, offset, limit),
        queryFn: async (): Promise<PaginatedPersonSearch> => {
            const response = await apiClient.get<PaginatedPersonSearch>(
                '/v1/people/search/results',
                { params: { q: query, offset, limit } }
            )
            return response.data
        },
        enabled: query.length >= 3,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
    })
}
