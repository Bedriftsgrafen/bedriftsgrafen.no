import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'

export interface BenchmarkMetric {
    company_value: number | null
    industry_avg: number | null
    industry_median: number | null
    percentile: number | null
}

export interface IndustryBenchmarkResponse {
    orgnr: string
    nace_code: string
    nace_division: string
    nace_name: string | null
    municipality_code: string | null  // null = national scope
    company_count: number
    revenue: BenchmarkMetric
    profit: BenchmarkMetric
    employees: BenchmarkMetric
    operating_margin: BenchmarkMetric
}

export function useBenchmarkQuery(
    naceCode: string | undefined,
    orgnr: string | undefined,
    municipalityCode?: string | null
) {
    return useQuery({
        queryKey: ['benchmark', naceCode, orgnr, municipalityCode ?? 'national'],
        queryFn: async () => {
            if (!naceCode || !orgnr) return null

            const params: Record<string, string> = {}
            if (municipalityCode) {
                params.municipality_code = municipalityCode
            }

            const response = await apiClient.get<IndustryBenchmarkResponse>(
                `/v1/stats/industries/${naceCode}/benchmark/${orgnr}`,
                { params }
            )
            return response.data
        },
        enabled: !!naceCode && !!orgnr,
        staleTime: 1000 * 60 * 60, // 1 hour cache
        retry: false, // Don't retry 404s (no benchmark data)
    })
}
