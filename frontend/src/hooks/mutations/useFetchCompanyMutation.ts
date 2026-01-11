import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useToastStore } from '../../store/toastStore'
import { apiClient } from '../../utils/apiClient'

interface FetchCompanyParams {
  orgnr: string
  fetch_financials?: boolean
}

interface FetchCompanyResponse {
  company_fetched: boolean
  financials_fetched: number
  errors: string[]
}

export function useFetchCompanyMutation() {
  const queryClient = useQueryClient()
  const { addToast } = useToastStore()

  return useMutation({
    mutationFn: async ({ orgnr, fetch_financials = true }: FetchCompanyParams) => {
      const response = await apiClient.post<FetchCompanyResponse>(
        `/v1/companies/${orgnr}/fetch`,
        { fetch_financials }
      )
      return response.data
    },
    onMutate: () => {
      addToast('info', 'Henter data fra Brønnøysundregistrene...')
    },
    onSuccess: (data, variables) => {
      // Show appropriate toast based on result FIRST to ensure feedback
      if (data.errors.length > 0) {
        // If there are errors, show error
        addToast('error', data.errors[0])
      } else if (!data.financials_fetched) {
        // No financial data found (0, null, undefined)
        addToast('warning', 'Fant ingen regnskapsdata hos Brønnøysundregistrene')
      } else {
        // Success - found financial data
        addToast('success', `Hentet ${data.financials_fetched} regnskapsår for bedriften`)
      }

      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['companies', variables.orgnr] })
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (error) => {
      // Show error toast
      const message = axios.isAxiosError(error)
        ? error.response?.data?.detail || 'Kunne ikke hente data fra Brønnøysund'
        : 'En ukjent feil oppsto'
      addToast('error', message)
    },
  })
}
