import { describe, it, expect, beforeEach } from 'vitest'
import { useFilterStore } from '../filterStore'

describe('filterStore', () => {
    // Reset store before each test
    beforeEach(() => {
        useFilterStore.getState().clearFilters()
    })

    describe('initial state', () => {
        it('has correct default values', () => {
            const state = useFilterStore.getState()

            expect(state.searchQuery).toBe('')
            expect(state.organizationForms).toEqual([])
            expect(state.naceCodes).toEqual([])
            expect(state.sortBy).toBe('navn')
            expect(state.sortOrder).toBe('asc')
            expect(state.isBankrupt).toBeNull()
        })
    })

    describe('setSearchQuery', () => {
        it('updates search query', () => {
            useFilterStore.getState().setSearchQuery('test company')
            expect(useFilterStore.getState().searchQuery).toBe('test company')
        })
    })

    describe('setOrganizationForms', () => {
        it('updates organization forms array', () => {
            useFilterStore.getState().setOrganizationForms(['AS', 'ASA'])
            expect(useFilterStore.getState().organizationForms).toEqual(['AS', 'ASA'])
        })

        it('can set empty array', () => {
            useFilterStore.getState().setOrganizationForms(['AS'])
            useFilterStore.getState().setOrganizationForms([])
            expect(useFilterStore.getState().organizationForms).toEqual([])
        })
    })

    describe('setRevenueRange', () => {
        it('sets min and max revenue', () => {
            useFilterStore.getState().setRevenueRange(1000000, 5000000)
            const state = useFilterStore.getState()
            expect(state.revenueMin).toBe(1000000)
            expect(state.revenueMax).toBe(5000000)
        })

        it('handles null values', () => {
            useFilterStore.getState().setRevenueRange(1000000, null)
            expect(useFilterStore.getState().revenueMin).toBe(1000000)
            expect(useFilterStore.getState().revenueMax).toBeNull()
        })
    })

    describe('setStatus', () => {
        it('sets isBankrupt filter', () => {
            useFilterStore.getState().setStatus('isBankrupt', true)
            expect(useFilterStore.getState().isBankrupt).toBe(true)
        })

        it('can reset to null', () => {
            useFilterStore.getState().setStatus('isBankrupt', true)
            useFilterStore.getState().setStatus('isBankrupt', null)
            expect(useFilterStore.getState().isBankrupt).toBeNull()
        })
    })

    describe('setSort', () => {
        it('updates sort by and order', () => {
            useFilterStore.getState().setSort('revenue', 'desc')
            const state = useFilterStore.getState()
            expect(state.sortBy).toBe('revenue')
            expect(state.sortOrder).toBe('desc')
        })
    })

    describe('clearFilters', () => {
        it('resets all filters to defaults', () => {
            // Set some filters
            useFilterStore.getState().setSearchQuery('test')
            useFilterStore.getState().setOrganizationForms(['AS'])
            useFilterStore.getState().setRevenueRange(1000000, 5000000)
            useFilterStore.getState().setStatus('isBankrupt', true)
            useFilterStore.getState().setSort('revenue', 'desc')

            // Clear
            useFilterStore.getState().clearFilters()

            // Verify reset
            const state = useFilterStore.getState()
            expect(state.searchQuery).toBe('')
            expect(state.organizationForms).toEqual([])
            expect(state.revenueMin).toBeNull()
            expect(state.revenueMax).toBeNull()
            expect(state.isBankrupt).toBeNull()
            expect(state.sortBy).toBe('navn')
            expect(state.sortOrder).toBe('asc')
        })
    })

    describe('getActiveFilterCount', () => {
        it('returns 0 for default state', () => {
            expect(useFilterStore.getState().getActiveFilterCount()).toBe(0)
        })

        it('counts search query as 1', () => {
            useFilterStore.getState().setSearchQuery('test')
            expect(useFilterStore.getState().getActiveFilterCount()).toBe(1)
        })

        it('counts organization forms as 1', () => {
            useFilterStore.getState().setOrganizationForms(['AS', 'ASA', 'ENK'])
            expect(useFilterStore.getState().getActiveFilterCount()).toBe(1)
        })

        it('counts revenue range as 1 filter', () => {
            useFilterStore.getState().setRevenueRange(1000000, 5000000)
            expect(useFilterStore.getState().getActiveFilterCount()).toBe(1)
        })

        it('counts multiple filters correctly', () => {
            useFilterStore.getState().setSearchQuery('test')
            useFilterStore.getState().setOrganizationForms(['AS'])
            useFilterStore.getState().setRevenueRange(1000000, null)
            useFilterStore.getState().setStatus('isBankrupt', true)
            expect(useFilterStore.getState().getActiveFilterCount()).toBe(4)
        })
    })

    describe('incrementFilterVersion', () => {
        it('increments filter version counter', () => {
            const initialVersion = useFilterStore.getState().filterVersion
            useFilterStore.getState().incrementFilterVersion()
            expect(useFilterStore.getState().filterVersion).toBe(initialVersion + 1)
        })
    })
})
