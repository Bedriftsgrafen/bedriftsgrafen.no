import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToastStore, getErrorMessage, withRequestReference } from '../../store/toastStore'
import { apiClient, getResponseRequestId } from '../../utils/apiClient'
import { getMessageForCode } from '../../utils/errorCodes'

interface FetchCompanyParams {
  orgnr: string
  fetch_financials?: boolean
}

interface FetchCompanyResponse {
  company_fetched: boolean
  financials_fetched: number
  error_code?: string | null
  errors: string[]
  request_id?: string
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
      return { ...response.data, request_id: getResponseRequestId(response) }
    },
    // Local onError handles this mutation's toast — opt out of global handler
    // to prevent the global mutationCache.onError from firing a second toast.
    meta: { showErrorToast: false },
    onMutate: () => {
      addToast('info', 'Henter data fra Brønnøysundregistrene...')
    },
    onSuccess: (data, variables) => {
      // Show appropriate toast based on result FIRST to ensure feedback
      if (data.errors.length > 0) {
        // If there are errors, show error
        const codedMessage = data.error_code ? getMessageForCode(data.error_code) : undefined
        addToast('error', withRequestReference(codedMessage ?? data.errors[0], data.request_id))
      } else if (!data.financials_fetched) {
        // No financial data found (0, null, undefined)
        addToast('warning', 'Fant ingen regnskapsdata hos Brønnøysundregistrene')
      } else {
        // Success - found financial data
        addToast('success', `Hentet ${data.financials_fetched} regnskapsår for virksomheten`)
      }

      // Invalidate queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['companies', variables.orgnr] })
      queryClient.invalidateQueries({ queryKey: ['companies'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (error) => {
      addToast('error', getErrorMessage(error))
    },
  })
}
