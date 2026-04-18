import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'
import { personQueryKeys } from './usePersonSearchQuery'
import type { PersonConnection } from '../../types/person'

export type { PersonConnection }

/**
 * Hook for fetching people connected via shared board/role memberships.
 *
 * Only fetches when enabled (typically when connections tab is active).
 * GDPR: Returns birth_year only for connected persons.
 */
export function usePersonConnectionsQuery(
    name: string | undefined,
    birthdate: string | null = null,
    enabled: boolean = true,
) {
    return useQuery({
        queryKey: personQueryKeys.connections(name ?? '', birthdate),
        queryFn: async (): Promise<PersonConnection[]> => {
            if (!name) return []
            const response = await apiClient.get<PersonConnection[]>('/v1/people/connections', {
                params: { name, ...(birthdate && { birthdate }) },
            })
            return response.data
        },
        enabled: !!name && enabled,
        staleTime: 1000 * 60 * 60, // 1 hour
        gcTime: 1000 * 60 * 60 * 2,
    })
}
