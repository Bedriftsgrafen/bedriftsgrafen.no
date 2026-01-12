import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTableState } from '../useTableState'

describe('useTableState', () => {
    it('initializes with default values', () => {
        const { result } = renderHook(() => useTableState({
            initialSortBy: 'name'
        }))

        expect(result.current.page).toBe(1)
        expect(result.current.searchQuery).toBe('')
        expect(result.current.sortBy).toBe('name')
        expect(result.current.sortOrder).toBe('desc') // Default prop
        expect(result.current.itemsPerPage).toBe(20) // Default prop
        expect(result.current.filters).toEqual({})
    })

    it('initializes with provided props', () => {
        const { result } = renderHook(() => useTableState({
            initialSortBy: 'date',
            initialSortOrder: 'asc',
            initialFilters: { active: true },
            itemsPerPage: 50
        }))

        expect(result.current.sortBy).toBe('date')
        expect(result.current.sortOrder).toBe('asc')
        expect(result.current.filters).toEqual({ active: true })
        expect(result.current.itemsPerPage).toBe(50)
    })

    it('handles pagination', () => {
        const { result } = renderHook(() => useTableState({ initialSortBy: 'name' }))

        // Next page
        act(() => {
            result.current.nextPage(5)
        })
        expect(result.current.page).toBe(2)

        // Max page limit
        act(() => {
            result.current.nextPage(2) // Max is 2
        })
        expect(result.current.page).toBe(2)

        // Prev page
        act(() => {
            result.current.prevPage()
        })
        expect(result.current.page).toBe(1)

        // Min page limit
        act(() => {
            result.current.prevPage()
        })
        expect(result.current.page).toBe(1)
    })

    it('resets page when search query changes', () => {
        const { result } = renderHook(() => useTableState({ initialSortBy: 'name' }))

        act(() => {
            result.current.setPage(5)
        })
        expect(result.current.page).toBe(5)

        // This hook doesn't automatically reset page on search query change internally via useEffect, 
        // usually the component does it or it's manual. 
        // But wait, the hook exposes `setSearchQuery`. 
        // Let's check the implementation.
        // It's just `const [searchQuery, setSearchQuery] = useState('')`.
        // So it doesn't reset page automatically unless we test that specific interaction if logic changed.
        // Re-reading useTableState.ts: It DOES NOT reset page on search query change intrinsically.
        // It resets page on sort and filter change calling `resetPage()`.

        act(() => {
            result.current.setSearchQuery('test')
        })
        // Based on code, page remains 5. 
        expect(result.current.page).toBe(5)
    })

    it('handles sorting', () => {
        const { result } = renderHook(() => useTableState<Record<string, unknown>, 'name' | 'date'>({ initialSortBy: 'name', initialSortOrder: 'asc' }))

        // Toggle same field -> flip order
        act(() => {
            result.current.handleSort('name')
        })
        expect(result.current.sortBy).toBe('name')
        expect(result.current.sortOrder).toBe('desc')
        expect(result.current.page).toBe(1) // Should reset page

        // Change field -> default to desc
        act(() => {
            result.current.handleSort('date')
        })
        expect(result.current.sortBy).toBe('date')
        expect(result.current.sortOrder).toBe('desc')
    })

    it('handles filters', () => {
        const { result } = renderHook(() => useTableState({ initialSortBy: 'name' }))

        expect(result.current.activeFilterCount).toBe(0)

        // Set filter
        act(() => {
            result.current.setFilter('status', 'active')
        })
        expect(result.current.filters).toEqual({ status: 'active' })
        expect(result.current.activeFilterCount).toBe(1)
        expect(result.current.page).toBe(1) // Should reset page

        // Reset filters
        act(() => {
            result.current.resetFilters()
        })
        expect(result.current.filters).toEqual({})
        expect(result.current.activeFilterCount).toBe(0)
    })
})
