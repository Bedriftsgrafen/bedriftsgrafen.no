import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../../utils/apiClient'
import { Company } from '../../types'

export function useSimilarCompaniesQuery(orgnr: string | null) {
  return useQuery({
    queryKey: ['companies', orgnr, 'similar'],
    queryFn: async () => {
      if (!orgnr) throw new Error('No orgnr provided')
      const response = await apiClient.get<Company[]>(`/v1/companies/${orgnr}/similar`, {
        params: { limit: 6 }
      })
      return response.data
    },
    enabled: !!orgnr,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })
}
