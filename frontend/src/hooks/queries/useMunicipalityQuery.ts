import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'
import { MunicipalityPremiumResponse, MunicipalityListItem } from '../../types'
import { municipalityQueryKeys } from '../../lib/queryKeys'

/**
 * Create query options for municipality dashboard
 */
export function getMunicipalityDashboardQueryOptions(
    code: string
): UseQueryOptions<MunicipalityPremiumResponse> {
    return {
        queryKey: municipalityQueryKeys.dashboard(code),
        queryFn: async () => {
            const response = await apiClient.get<MunicipalityPremiumResponse>(
                `/v1/municipality/${code}`
            )
            return response.data
        },
        staleTime: 60 * 60 * 1000, // 1 hour for municipality data (refreshed nightly anyway)
        retry: 2,
    }
}

export function useMunicipalityQuery(code: string | null) {
    return useQuery({
        ...getMunicipalityDashboardQueryOptions(code || ''),
        enabled: !!code && code.length === 4,
    })
}

/**
 * Fetch list of all municipalities for explorer/search
 */
export function useMunicipalitiesListQuery() {
    return useQuery({
        queryKey: municipalityQueryKeys.lists(),
        queryFn: async () => {
            const response = await apiClient.get<MunicipalityListItem[]>(
                '/v1/municipality/'
            )
            return response.data
        },
        staleTime: 24 * 60 * 60 * 1000, // 24 hours
    })
}
