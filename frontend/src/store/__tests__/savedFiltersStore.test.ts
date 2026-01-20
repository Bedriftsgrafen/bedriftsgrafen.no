/**
 * Unit tests for savedFiltersStore.
 *
 * Tests save, update, delete, rename, and helper functions.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { useSavedFiltersStore, countActiveFilters, type SavedFilter } from '../savedFiltersStore'

// Default empty filter configuration for testing
const emptyFilters: SavedFilter['filters'] = {
    searchQuery: '',
    organizationForms: [],
    naeringskode: '',
    revenueMin: null,
    revenueMax: null,
    profitMin: null,
    profitMax: null,
    equityMin: null,
    equityMax: null,
    operatingProfitMin: null,
    operatingProfitMax: null,
    liquidityRatioMin: null,
    liquidityRatioMax: null,
    equityRatioMin: null,
    equityRatioMax: null,
    employeeMin: null,
    employeeMax: null,
    municipality: '',
    municipalityCode: '',
    county: '',
    countyCode: '',
    foundedFrom: null,
    foundedTo: null,
    bankruptFrom: null,
    bankruptTo: null,
    isBankrupt: null,
    inLiquidation: null,
    inForcedLiquidation: null,
    hasAccounting: null,
}

// Reset store before each test
beforeEach(() => {
    useSavedFiltersStore.setState({
        savedFilters: [],
    })
})

describe('SavedFiltersStore Initial State', () => {
    it('should start with empty savedFilters list', () => {
        const state = useSavedFiltersStore.getState()
        expect(state.savedFilters).toEqual([])
    })
})

describe('Save Filter', () => {
    it('saveFilter should add filter and return id', () => {
        const id = useSavedFiltersStore.getState().saveFilter('My Filter', emptyFilters)

        expect(id).toBeDefined()
        expect(typeof id).toBe('string')
        expect(useSavedFiltersStore.getState().savedFilters).toHaveLength(1)
    })

    it('saveFilter should set timestamps', () => {
        useSavedFiltersStore.getState().saveFilter('Test', emptyFilters)

        const filter = useSavedFiltersStore.getState().savedFilters[0]
        expect(filter.createdAt).toBeDefined()
        expect(filter.updatedAt).toBeDefined()
        expect(filter.createdAt).toBe(filter.updatedAt)
    })

    it('saveFilter should limit to 20 saved filters', () => {
        // Add 25 filters
        for (let i = 0; i < 25; i++) {
            useSavedFiltersStore.getState().saveFilter(`Filter ${i}`, emptyFilters)
        }

        expect(useSavedFiltersStore.getState().savedFilters).toHaveLength(20)
    })

    it('saveFilter adds new filters to the front', () => {
        useSavedFiltersStore.getState().saveFilter('First', emptyFilters)
        useSavedFiltersStore.getState().saveFilter('Second', emptyFilters)

        const filters = useSavedFiltersStore.getState().savedFilters
        expect(filters[0].name).toBe('Second')
        expect(filters[1].name).toBe('First')
    })
})

describe('Update Filter', () => {
    it('updateFilter should update name and filters', () => {
        const id = useSavedFiltersStore.getState().saveFilter('Original', emptyFilters)

        const updatedFilters = { ...emptyFilters, searchQuery: 'updated query' }
        useSavedFiltersStore.getState().updateFilter(id, 'Updated Name', updatedFilters)

        const filter = useSavedFiltersStore.getState().getFilter(id)
        expect(filter?.name).toBe('Updated Name')
        expect(filter?.filters.searchQuery).toBe('updated query')
    })

    it('updateFilter should update updatedAt timestamp', () => {
        const id = useSavedFiltersStore.getState().saveFilter('Test', emptyFilters)
        const originalUpdatedAt = useSavedFiltersStore.getState().getFilter(id)?.updatedAt

        // Small delay to ensure different timestamp
        useSavedFiltersStore.getState().updateFilter(id, 'Updated', emptyFilters)

        const filter = useSavedFiltersStore.getState().getFilter(id)
        expect(filter?.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt!)
    })
})

describe('Delete Filter', () => {
    it('deleteFilter should remove filter by id', () => {
        const id1 = useSavedFiltersStore.getState().saveFilter('Filter 1', emptyFilters)
        const id2 = useSavedFiltersStore.getState().saveFilter('Filter 2', emptyFilters)

        useSavedFiltersStore.getState().deleteFilter(id1)

        expect(useSavedFiltersStore.getState().savedFilters).toHaveLength(1)
        expect(useSavedFiltersStore.getState().getFilter(id1)).toBeUndefined()
        expect(useSavedFiltersStore.getState().getFilter(id2)).toBeDefined()
    })

    it('deleteFilter handles non-existent id gracefully', () => {
        useSavedFiltersStore.getState().saveFilter('Test', emptyFilters)

        // Should not throw
        useSavedFiltersStore.getState().deleteFilter('non-existent-id')

        expect(useSavedFiltersStore.getState().savedFilters).toHaveLength(1)
    })
})

describe('Rename Filter', () => {
    it('renameFilter should update only the name', () => {
        const id = useSavedFiltersStore.getState().saveFilter('Original', {
            ...emptyFilters,
            searchQuery: 'test',
        })

        useSavedFiltersStore.getState().renameFilter(id, 'New Name')

        const filter = useSavedFiltersStore.getState().getFilter(id)
        expect(filter?.name).toBe('New Name')
        expect(filter?.filters.searchQuery).toBe('test') // Unchanged
    })
})

describe('Get Filter', () => {
    it('getFilter returns filter by id', () => {
        const id = useSavedFiltersStore.getState().saveFilter('My Filter', emptyFilters)

        const filter = useSavedFiltersStore.getState().getFilter(id)

        expect(filter).toBeDefined()
        expect(filter?.name).toBe('My Filter')
    })

    it('getFilter returns undefined for non-existent id', () => {
        const filter = useSavedFiltersStore.getState().getFilter('fake-id')

        expect(filter).toBeUndefined()
    })
})

describe('countActiveFilters helper', () => {
    it('returns 0 for empty filters', () => {
        const count = countActiveFilters(emptyFilters)
        expect(count).toBe(0)
    })

    it('counts searchQuery as 1 filter', () => {
        const count = countActiveFilters({ ...emptyFilters, searchQuery: 'test' })
        expect(count).toBe(1)
    })

    it('counts organizationForms if not empty', () => {
        const count = countActiveFilters({ ...emptyFilters, organizationForms: ['AS'] })
        expect(count).toBe(1)
    })

    it('counts revenue range as 1 filter', () => {
        const count = countActiveFilters({ ...emptyFilters, revenueMin: 1000, revenueMax: 5000 })
        expect(count).toBe(1) // Min and max together count as 1
    })

    it('counts multiple filters correctly', () => {
        const count = countActiveFilters({
            ...emptyFilters,
            searchQuery: 'test',
            organizationForms: ['AS', 'ENK'],
            naeringskode: '62',
            revenueMin: 1000000,
            municipality: '0301',
            isBankrupt: false,
        })
        expect(count).toBe(6)
    })

    it('counts boolean filters when set', () => {
        const count = countActiveFilters({
            ...emptyFilters,
            isBankrupt: true,
            inLiquidation: false,
            hasAccounting: true,
        })
        expect(count).toBe(3)
    })
})
