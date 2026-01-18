import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'

export interface PersonSearchResult {
    name: string
    birthdate: string | null
    role_count: number
}

// Centralized query key factory for consistency
export const personQueryKeys = {
    all: ['people'] as const,
    search: (query: string) => [...personQueryKeys.all, 'search', query] as const,
    roles: (name: string, birthdate: string | null) =>
        [...personQueryKeys.all, 'roles', name, birthdate] as const,
}

/**
 * Hook for searching for people across all company roles.
 *
 * Features:
 * - Trigram-based fuzzy search
 * - Only returns people with commercial roles (Enhetsregisterloven § 22)
 * - Debounce-friendly with appropriate stale time
 */
export function usePersonSearchQuery(query: string, limit: number = 10) {
    return useQuery({
        queryKey: personQueryKeys.search(query),
        queryFn: async (): Promise<PersonSearchResult[]> => {
            if (query.length < 3) return []
            const response = await apiClient.get<PersonSearchResult[]>(
                '/v1/people/search',
                { params: { q: query, limit } }
            )
            return response.data
        },
        enabled: query.length >= 3,
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
    })
}
