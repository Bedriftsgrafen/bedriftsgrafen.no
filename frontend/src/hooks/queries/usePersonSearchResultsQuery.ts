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
export function usePersonSearchResultsQuery(
    query: string,
    offset: number = 0,
    limit: number = 20,
    sortBy: string = 'role_count',
    sortOrder: string = 'desc',
) {
    return useQuery({
        queryKey: personQueryKeys.searchResults(query, offset, limit, sortBy, sortOrder),
        queryFn: async (): Promise<PaginatedPersonSearch> => {
            const response = await apiClient.get<PaginatedPersonSearch>(
                '/v1/people/search/results',
                { params: { q: query, offset, limit, sort_by: sortBy, sort_order: sortOrder } }
            )
            return response.data
        },
        enabled: query.length >= 3,
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
    })
}
