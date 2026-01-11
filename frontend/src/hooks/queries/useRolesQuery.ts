import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'

export interface Role {
    id?: number
    type_kode: string | null
    type_beskrivelse: string | null
    person_navn: string | null
    foedselsdato: string | null
    enhet_orgnr: string | null
    enhet_navn: string | null
    fratraadt: boolean
    rekkefoelge: number | null
}

interface RolesResponse {
    data: Role[]
    total: number
    metadata?: Record<string, unknown>
}

/**
 * Hook for fetching roles (roller) for a company
 * Uses on-demand caching: returns cached DB data if available, otherwise fetches from API
 */
export function useRolesQuery(orgnr: string | undefined) {
    const queryClient = useQueryClient()

    const query = useQuery({
        queryKey: ['roles', orgnr],
        queryFn: async () => {
            if (!orgnr) return []
            const response = await apiClient.get<RolesResponse>(`/v1/companies/${orgnr}/roles`)
            return response.data?.data || []
        },
        enabled: !!orgnr,
        staleTime: 1000 * 60 * 60 * 24, // 24 hours (rarely changes)
        gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour
        retry: 1,
        retryDelay: 1000,
    })

    /**
     * Force fetch roles from Brønnøysundregistrene API.
     * This bypasses cache and triggers actual API call.
     */
    const fetchFromBrreg = async () => {
        if (!orgnr) return

        // Invalidate cache
        await queryClient.invalidateQueries({ queryKey: ['roles', orgnr] })

        // Fetch with force_refresh=true
        const response = await apiClient.get<RolesResponse>(
            `/v1/companies/${orgnr}/roles`,
            { params: { force_refresh: true } }
        )

        // Update cache with fresh data
        queryClient.setQueryData(['roles', orgnr], response.data?.data || [])

        return response.data?.data || []
    }

    return {
        ...query,
        fetchFromBrreg,
    }
}
