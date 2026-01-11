import { useQuery } from '@tanstack/react-query'
import { API_BASE } from '../../utils/apiClient'

interface TrendDataPoint {
    month: string
    count: number
}

type TrendMetric = 'bankruptcies' | 'new_companies'

async function fetchTrendTimeline(metric: TrendMetric, months: number = 12): Promise<TrendDataPoint[]> {
    const res = await fetch(`${API_BASE}/v1/trends/timeline?metric=${metric}&months=${months}`)
    if (!res.ok) throw new Error('Failed to fetch trend data')
    return res.json()
}

export function useTrendQuery(metric: TrendMetric, months: number = 12) {
    return useQuery({
        queryKey: ['trends', 'timeline', metric, months],
        queryFn: () => fetchTrendTimeline(metric, months),
        staleTime: 1000 * 60 * 30, // 30 minutes
    })
}
