import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'

export type ActivityCompanyItem = {
  orgnr: string
  navn?: string | null
  organisasjonsform?: string | null
  naeringskode?: string | null
  antall_ansatte?: number | null
  event_date?: string | null
  event_label: string
  source: string
  time_semantics: string
}

export type ActivityFeed = {
  id: 'new_companies' | 'bankruptcies'
  title: string
  description: string
  source: string
  time_label: string
  items: ActivityCompanyItem[]
}

export type ActivityStatusItem = {
  key: string
  title: string
  description: string
  value?: string | null
  updated_at?: string | null
  source: string
}

export type ActivityDeferredFeed = {
  id: 'accounting_updates'
  title: string
  reason: string
  requirement: string
}

export type ActivityOverview = {
  generated_at: string
  cache_ttl_seconds: number
  new_companies: ActivityFeed
  bankruptcies: ActivityFeed
  data_status: ActivityStatusItem[]
  deferred_feeds: ActivityDeferredFeed[]
}

export function useActivityOverviewQuery(limit = 12) {
  return useQuery({
    queryKey: ['activity-overview', { limit }] as const,
    queryFn: async () => {
      const response = await apiClient.get<ActivityOverview>('/v1/activity/overview', { params: { limit } })
      return response.data
    },
    staleTime: 120_000,
    retry: 1,
    refetchOnWindowFocus: false,
    meta: { showErrorToast: false },
  })
}
