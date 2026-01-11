import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'

/** Organisation form breakdown item */
interface OrgFormBreakdown {
    form: string
    count: number
}

/** Response from /v1/companies/stats endpoint */
export interface CompanyStatsResponse {
    total_count: number
    total_revenue: number
    total_profit: number
    total_employees: number
    by_organisasjonsform: OrgFormBreakdown[]
}

/** Query parameters - same as count query */
export interface UseCompanyStatsQueryParams {
    name?: string
    organisasjonsform?: string[]
    naeringskode?: string
    min_revenue?: number
    max_revenue?: number
    min_profit?: number
    max_profit?: number
    min_employees?: number
    max_employees?: number
    municipality?: string
    county?: string
    founded_from?: string
    founded_to?: string
    is_bankrupt?: boolean
    in_liquidation?: boolean
    in_forced_liquidation?: boolean
}

async function fetchCompanyStats(params: UseCompanyStatsQueryParams): Promise<CompanyStatsResponse> {
    const { data } = await apiClient.get<CompanyStatsResponse>('/v1/companies/stats', { params })
    return data
}

export function useCompanyStatsQuery(params: UseCompanyStatsQueryParams) {
    return useQuery({
        queryKey: ['companyStats', params],
        queryFn: () => fetchCompanyStats(params),
        staleTime: 30_000, // Cache for 30 seconds
    })
}
