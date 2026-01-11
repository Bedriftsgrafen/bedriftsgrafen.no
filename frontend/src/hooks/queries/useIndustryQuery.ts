import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'
import type { Company } from '../../types'

export interface IndustryCompaniesResponse {
    items: Company[]
    total: number
    page: number
    pages: number
    limit: number
    nace_code: string
    has_more: boolean
}

interface UseIndustryQueryOptions {
    naceCode: string | null
    page?: number
    limit?: number
    includeInactive?: boolean
    enabled?: boolean
}

export function useIndustryQuery({
    naceCode,
    page = 1,
    limit = 20,
    includeInactive = false,
    enabled = true
}: UseIndustryQueryOptions) {
    return useQuery({
        queryKey: ['industry', naceCode, page, limit, includeInactive],
        queryFn: async () => {
            if (!naceCode) return null

            const response = await apiClient.get<IndustryCompaniesResponse>(
                `/v1/companies/industry/${encodeURIComponent(naceCode)}`,
                {
                    params: {
                        page,
                        limit,
                        include_inactive: includeInactive
                    }
                }
            )
            return response.data
        },
        enabled: enabled && !!naceCode,
        placeholderData: (prev) => prev, // Keep previous data during pagination
        staleTime: 5 * 60 * 1000, // 5 minutes - industry data changes slowly
    })
}
