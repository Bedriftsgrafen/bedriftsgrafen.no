import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'
import { personQueryKeys } from './usePersonSearchQuery'
import type { PersonRole } from '../../types/person'

export type { PersonRole }

/**
 * Hook for fetching all LEGALLY ALLOWED roles for a person.
 *
 * Only includes commercial entities (næringsvirksomhet) per Enhetsregisterloven § 22.
 * Roles in voluntary organizations, housing cooperatives, etc. are excluded.
 */
export function usePersonRolesQuery(name: string | undefined, birthdate: string | null = null) {
    return useQuery({
        queryKey: personQueryKeys.roles(name ?? '', birthdate),
        queryFn: async (): Promise<PersonRole[]> => {
            if (!name) return []
            const response = await apiClient.get<PersonRole[]>('/v1/people/roles', {
                params: { name, ...(birthdate && { birthdate }) },
            })
            return response.data
        },
        enabled: !!name,
        staleTime: 1000 * 60 * 60, // 1 hour (roles rarely change)
        gcTime: 1000 * 60 * 60 * 2, // Keep in cache for 2 hours
    })
}
