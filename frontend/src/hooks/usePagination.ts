import { useCallback, useMemo } from 'react'
import { useUiStore } from '../store/uiStore'

interface UsePaginationOptions {
  itemsPerPage: number
  currentItemsCount: number
}

/**
 * Hook for pagination logic
 * Uses useMemo for computed values to prevent unnecessary recalculations
 */
export function usePagination({ itemsPerPage, currentItemsCount }: UsePaginationOptions) {
  const currentPage = useUiStore(s => s.currentPage)
  const setPage = useUiStore(s => s.setPage)

  const handlePreviousPage = useCallback(() => {
    setPage(Math.max(1, currentPage - 1))
  }, [currentPage, setPage])

  const handleNextPage = useCallback(() => {
    if (currentItemsCount >= itemsPerPage) {
      setPage(currentPage + 1)
    }
  }, [currentPage, currentItemsCount, itemsPerPage, setPage])

  const goToPage = useCallback((page: number) => {
    setPage(Math.max(1, page))
  }, [setPage])

  // Memoize computed values
  const paginationState = useMemo(() => ({
    isFirstPage: currentPage === 1,
    isLastPage: currentItemsCount < itemsPerPage
  }), [currentPage, currentItemsCount, itemsPerPage])

  return {
    currentPage,
    handlePreviousPage,
    handleNextPage,
    goToPage,
    ...paginationState
  }
}
