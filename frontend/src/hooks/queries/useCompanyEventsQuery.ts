import { useQuery } from '@tanstack/react-query'
import { companyQueryKeys } from '../../lib/queryKeys'
import { apiClient } from '../../utils/apiClient'
import { isAutomatedClient } from '../../utils/automatedClient'

export type CompanyEventItem = {
  id: number
  orgnr: string
  event_type: string
  title: string
  source: string
  source_update_id?: string | null
  occurred_at?: string | null
  observed_at: string
  time_semantics: string
  previous_value?: Record<string, unknown> | null
  new_value?: Record<string, unknown> | null
  payload?: Record<string, unknown> | null
}

export type CompanyEventListResponse = {
  generated_at: string
  cache_ttl_seconds: number
  orgnr: string
  limit: number
  offset: number
  has_more: boolean
  events: CompanyEventItem[]
}

export function useCompanyEventsQuery(orgnr: string | null, limit = 6, offset = 0) {
  return useQuery({
    queryKey: companyQueryKeys.events(orgnr || '', limit, offset),
    queryFn: async () => {
      const response = await apiClient.get<CompanyEventListResponse>(`/v1/activity/events/${orgnr}`, {
        params: { limit, offset },
      })
      return response.data
    },
    enabled: !!orgnr && !isAutomatedClient(),
    staleTime: 5 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    meta: { showErrorToast: false },
  })
}
