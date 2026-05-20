import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'
import { Company } from '../../types'
import { canRunCompanySearch, normalizeCompanySearchQuery } from '../../utils/searchValidation'

export function useCompanySearchQuery(query: string, limit = 10) {
  const normalizedQuery = normalizeCompanySearchQuery(query)

  return useQuery({
    queryKey: ['companies', 'search', normalizedQuery, limit],
    queryFn: async () => {
      const response = await apiClient.get<Company[]>('/v1/companies/search', {
        params: { name: normalizedQuery, limit }
      })
      return response.data
    },
    enabled: canRunCompanySearch(normalizedQuery),
    placeholderData: [],
    staleTime: 2 * 60 * 1000, // 2 minutes for search results
  })
}
