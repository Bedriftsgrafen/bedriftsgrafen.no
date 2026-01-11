import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'
import { Company } from '../../types'

export function useCompanySearchQuery(query: string, limit = 10) {
  return useQuery({
    queryKey: ['companies', 'search', query, limit],
    queryFn: async () => {
      const response = await apiClient.get<Company[]>('/v1/companies/search', {
        params: { name: query, limit }
      })
      return response.data
    },
    enabled: query.length >= 2, // Only run query if search term is at least 2 characters
    staleTime: 2 * 60 * 1000, // 2 minutes for search results
  })
}
