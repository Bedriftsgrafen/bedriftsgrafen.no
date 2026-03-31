import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'
import { IndustryPremiumResponse } from '../../types'
import { industryQueryKeys } from '../../lib/queryKeys'

export function getIndustryDashboardQueryOptions(
    code: string
): UseQueryOptions<IndustryPremiumResponse> {
    return {
        queryKey: industryQueryKeys.dashboard(code),
        queryFn: async () => {
            const response = await apiClient.get<IndustryPremiumResponse>(
                `/v1/stats/industries/${code}/dashboard`
            )
            return response.data
        },
        staleTime: 60 * 60 * 1000, // 1 hour (refreshed nightly)
        retry: 2,
    }
}

/**
 * Fetch industry premium dashboard data.
 * @param code 2-digit NACE division code or slug (e.g., "62" or "62-informasjonsteknologi")
 */
export function useIndustryDashboardQuery(code: string | null) {
    const cleanCode = code?.split('-')[0] || ''
    const isValidCode = /^\d{2}$/.test(cleanCode)

    return useQuery({
        ...getIndustryDashboardQueryOptions(cleanCode),
        enabled: !!code && isValidCode,
    })
}
