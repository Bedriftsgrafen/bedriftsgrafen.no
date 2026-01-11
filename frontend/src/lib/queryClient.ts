import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { toast, getErrorMessage } from '../store/toastStore'

/**
 * QueryClient configured for Efficient performance optimization
 * - Longer stale times to reduce API calls
 * - Limited retries to save resources
 * - No refetch on window focus to reduce background requests
 * - Global error handling with toast notifications
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Skip toast if query has meta.showErrorToast = false
      if (query.meta?.showErrorToast === false) return
      
      // Only show toast for queries that have no cached data
      // This prevents spam from background refetch failures
      if (query.state.data === undefined) {
        toast.error(getErrorMessage(error))
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      // Skip toast if mutation has meta.showErrorToast = false
      if (mutation.meta?.showErrorToast === false) return
      
      toast.error(getErrorMessage(error))
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh longer
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 2, // Limited retries to save resources
      refetchOnWindowFocus: false, // Reduce background requests
      refetchOnReconnect: true, // But do refetch on reconnect
      refetchOnMount: true, // Refetch on component mount
    },
    mutations: {
      retry: 1, // Retry mutations once on failure
    },
  },
})
