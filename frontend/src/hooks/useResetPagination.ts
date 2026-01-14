import { useCallback } from 'react'
import { useUiStore } from '../store/uiStore'

/**
 * Hook for resetting pagination with optional side effects
 * Centralizes pagination reset logic for DRY principle
 */
export function useResetPagination() {
  const setPage = useUiStore(s => s.setPage)

  const resetPagination = useCallback(() => {
    setPage(1)
    // Future: Add scroll to top, analytics tracking, etc.
  }, [setPage])

  return resetPagination
}
