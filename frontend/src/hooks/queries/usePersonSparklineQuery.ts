import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'
import type { CompanySparklineData } from '../../types/person'
import { personQueryKeys } from './usePersonSearchQuery'

/**
 * Hook for fetching mini financial time-series for a person's companies.
 * Lazy-loaded: only fires when `enabled` is true (Roller tab active).
 */
export function usePersonSparklineQuery(
    name: string,
    birthdate: string | null,
    enabled: boolean,
    years: number = 5
) {
    return useQuery({
        queryKey: personQueryKeys.sparklines(name, birthdate),
        queryFn: async (): Promise<CompanySparklineData[]> => {
            const response = await apiClient.get<CompanySparklineData[]>(
                '/v1/people/sparklines',
                { params: { name, birthdate, years } }
            )
            return response.data
        },
        enabled: enabled && name.length > 0,
        staleTime: 1000 * 60 * 10,
    })
}
