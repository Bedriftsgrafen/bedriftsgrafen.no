import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import axios from 'axios'
import { toast, getErrorMessage } from '../store/toastStore'

/**
 * Retry predicate shared by queries and mutations.
 *
 * Never retry on client errors that the user cannot fix by retrying:
 *   400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found,
 *   405 Method Not Allowed, 422 Unprocessable Entity.
 *
 * Always retry (up to `max`) on server errors, rate-limits, timeouts,
 * and network failures — these are transient and may resolve.
 *
 * Toast policy for queries/mutations:
 *   - Use the global queryCache/mutationCache onError handlers by default.
 *   - If a hook handles errors locally (e.g. shows a custom UI), set
 *     `meta: { showErrorToast: false }` on the query/mutation options.
 *   - Never have BOTH a local onError toast AND rely on the global handler
 *     for the same hook — that produces duplicate toasts.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  const max = 2
  if (failureCount >= max) return false
  if (axios.isAxiosError(error) && error.response) {
    const { status } = error.response
    // Non-retriable 4xx: permanent client errors
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
      return false
    }
  }
  return true
}

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
      retry: shouldRetry,
      refetchOnWindowFocus: false, // Reduce background requests
      refetchOnReconnect: true, // But do refetch on reconnect
      refetchOnMount: true, // Refetch on component mount
    },
    mutations: {
      retry: (count, err) => shouldRetry(count, err) && count < 1, // one retry cap
    },
  },
})
