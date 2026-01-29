import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'
import { CountyPremiumResponse, CountyListItem } from '../../types'
import { countyQueryKeys } from '../../lib/queryKeys'

/**
 * Create query options for county dashboard
 */
export function getCountyDashboardQueryOptions(
    code: string
): UseQueryOptions<CountyPremiumResponse> {
    return {
        queryKey: countyQueryKeys.dashboard(code),
        queryFn: async () => {
            const response = await apiClient.get<CountyPremiumResponse>(
                `/v1/county/${code}`
            )
            return response.data
        },
        staleTime: 60 * 60 * 1000, // 1 hour for county data (refreshed nightly anyway)
        retry: 2,
    }
}

/**
 * Fetch county dashboard data
 * @param code 2-digit county code (e.g., "46" for Vestland) or slug (e.g., "46-vestland")
 */
export function useCountyQuery(code: string | null) {
    // Extract numeric code from potential slug (e.g., "46-vestland" -> "46")
    const cleanCode = code?.split('-')[0] || ''
    const isValidCode = /^\d{2}$/.test(cleanCode)
    
    return useQuery({
        ...getCountyDashboardQueryOptions(cleanCode),
        enabled: !!code && isValidCode,
    })
}

/**
 * Fetch list of all counties for index page
 */
export function useCountiesListQuery() {
    return useQuery({
        queryKey: countyQueryKeys.lists(),
        queryFn: async () => {
            const response = await apiClient.get<CountyListItem[]>(
                '/v1/county/'
            )
            return response.data
        },
        staleTime: 24 * 60 * 60 * 1000, // 24 hours
    })
}
