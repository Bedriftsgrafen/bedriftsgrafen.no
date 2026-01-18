import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'

export interface UseCompanyCountQueryParams {
    name?: string
    organisasjonsform?: string[]
    naeringskode?: string
    min_revenue?: number
    max_revenue?: number
    min_profit?: number
    max_profit?: number
    min_equity?: number
    max_equity?: number
    min_operating_profit?: number
    max_operating_profit?: number
    min_liquidity_ratio?: number
    max_liquidity_ratio?: number
    min_equity_ratio?: number
    max_equity_ratio?: number
    min_employees?: number
    municipality?: string
    municipality_code?: string
    county?: string
    founded_from?: string
    founded_to?: string
    bankrupt_from?: string
    bankrupt_to?: string
    is_bankrupt?: boolean
    in_forced_liquidation?: boolean
    has_accounting?: boolean
    exclude_org_form?: string[]
    sort_by?: string  // Added to match list query behavior
}

async function fetchCompanyCount(params: UseCompanyCountQueryParams): Promise<number> {
    const { data } = await apiClient.get<number>('/v1/companies/count', { params })
    return data
}

export function useCompanyCountQuery(params: UseCompanyCountQueryParams) {
    return useQuery({
        queryKey: ['companyCount', params],
        queryFn: () => fetchCompanyCount(params),
        staleTime: 30_000, // Cache for 30 seconds to reduce API calls
        // Don't keep old data when filters change
    })
}
