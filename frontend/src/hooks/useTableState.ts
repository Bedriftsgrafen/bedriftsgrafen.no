import { useState, useCallback } from 'react'

export type SortOrder = 'asc' | 'desc'

interface UseTableStateOptions<TFilters, TSortField> {
    initialSortBy: TSortField
    initialSortOrder?: SortOrder
    initialFilters?: TFilters
    itemsPerPage?: number
}

export function useTableState<TFilters extends Record<string, unknown>, TSortField extends string>({
    initialSortBy,
    initialSortOrder = 'desc',
    initialFilters = {} as TFilters,
    itemsPerPage = 20
}: UseTableStateOptions<TFilters, TSortField>) {
    // Pagination
    const [page, setPage] = useState(1)

    // Search
    const [searchQuery, setSearchQuery] = useState('')

    // Sorting
    const [sortBy, setSortBy] = useState<TSortField>(initialSortBy)
    const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder)

    // Filters
    const [filters, setFilters] = useState<TFilters>(initialFilters)
    const [showFilters, setShowFilters] = useState(false)

    // Helpers
    const resetPage = useCallback(() => setPage(1), [])

    const handleNextPage = useCallback((totalPages: number) => {
        setPage(p => Math.min(totalPages, p + 1))
    }, [])

    const handlePrevPage = useCallback(() => {
        setPage(p => Math.max(1, p - 1))
    }, [])

    const handleSort = useCallback((field: TSortField) => {
        setSortBy(prevField => {
            if (prevField === field) {
                setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
                return prevField
            } else {
                setSortOrder('desc')
                return field
            }
        })
        resetPage()
    }, [resetPage])

    const setFilter = useCallback(<K extends keyof TFilters>(key: K, value: TFilters[K]) => {
        setFilters(prev => ({ ...prev, [key]: value }))
        resetPage()
    }, [resetPage])

    const resetFilters = useCallback(() => {
        setFilters(initialFilters)
        resetPage()
    }, [initialFilters, resetPage])

    // Specific filter helpers (for cleaner usage in components)
    // You can iterate over filters in the component, but these helpers cover common patterns
    const activeFilterCount = Object.values(filters).filter(Boolean).length

    return {
        // State
        page,
        setPage,
        searchQuery,
        setSearchQuery,
        sortBy,
        sortOrder,
        filters,
        showFilters,
        setShowFilters,
        itemsPerPage,

        // Computed
        activeFilterCount,
        hasActiveFilters: activeFilterCount > 0,

        // Actions
        nextPage: handleNextPage,
        prevPage: handlePrevPage,
        handleSort,
        setFilter,
        resetFilters,
        resetPage
    }
}
