/**
 * Unit tests for uiStore.
 *
 * Tests state management, actions, and persistence behavior.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore, type CompanyColumn, COLUMN_CONFIG } from '../uiStore'

// Reset store before each test
beforeEach(() => {
    useUiStore.setState({
        selectedYear: null,
        currentPage: 1,
        itemsPerPage: 20,
        viewMode: 'list',
        visibleColumns: ['navn', 'orgnr', 'organisasjonsform', 'naeringskode', 'antall_ansatte', 'revenue', 'profit'],
        recentCompanies: [],
        recentSearches: [],
    })
})

describe('UiStore Initial State', () => {
    it('should have correct initial pagination', () => {
        const state = useUiStore.getState()
        expect(state.currentPage).toBe(1)
        expect(state.itemsPerPage).toBe(20)
    })

    it('should have list as default view mode', () => {
        const state = useUiStore.getState()
        expect(state.viewMode).toBe('list')
    })

    it('should have default visible columns', () => {
        const state = useUiStore.getState()
        expect(state.visibleColumns).toContain('navn')
        expect(state.visibleColumns).toContain('orgnr')
    })
})

describe('Pagination Actions', () => {
    it('setPage should update currentPage', () => {
        useUiStore.getState().setPage(5)
        expect(useUiStore.getState().currentPage).toBe(5)
    })

    it('setItemsPerPage should update and reset page to 1', () => {
        useUiStore.getState().setPage(3)
        useUiStore.getState().setItemsPerPage(50)

        const state = useUiStore.getState()
        expect(state.itemsPerPage).toBe(50)
        expect(state.currentPage).toBe(1)
    })
})

describe('View Mode Actions', () => {
    it('setViewMode should switch to grid', () => {
        useUiStore.getState().setViewMode('grid')
        expect(useUiStore.getState().viewMode).toBe('grid')
    })

    it('setViewMode should switch back to list', () => {
        useUiStore.getState().setViewMode('grid')
        useUiStore.getState().setViewMode('list')
        expect(useUiStore.getState().viewMode).toBe('list')
    })
})

describe('Column Management', () => {
    it('toggleColumn should add a hidden column', () => {
        const initialColumns = useUiStore.getState().visibleColumns
        expect(initialColumns).not.toContain('stiftelsesdato')

        useUiStore.getState().toggleColumn('stiftelsesdato')

        expect(useUiStore.getState().visibleColumns).toContain('stiftelsesdato')
    })

    it('toggleColumn should remove a visible column', () => {
        expect(useUiStore.getState().visibleColumns).toContain('profit')

        useUiStore.getState().toggleColumn('profit')

        expect(useUiStore.getState().visibleColumns).not.toContain('profit')
    })

    it('toggleColumn should not remove last column', () => {
        // Set to only one column
        useUiStore.setState({ visibleColumns: ['navn'] })

        useUiStore.getState().toggleColumn('navn')

        // Should still have the column
        expect(useUiStore.getState().visibleColumns).toContain('navn')
    })

    it('setVisibleColumns should replace all columns', () => {
        useUiStore.getState().setVisibleColumns(['navn', 'orgnr'])

        const columns = useUiStore.getState().visibleColumns
        expect(columns).toHaveLength(2)
        expect(columns).toContain('navn')
        expect(columns).toContain('orgnr')
    })

    it('resetColumns should restore defaults', () => {
        useUiStore.setState({ visibleColumns: ['navn'] })
        useUiStore.getState().resetColumns()

        const columns = useUiStore.getState().visibleColumns
        expect(columns.length).toBeGreaterThan(1)
    })

    it('reorderColumns should swap column positions', () => {
        useUiStore.setState({ visibleColumns: ['navn', 'orgnr', 'profit'] })

        useUiStore.getState().reorderColumns(0, 2)

        expect(useUiStore.getState().visibleColumns).toEqual(['orgnr', 'profit', 'navn'])
    })

    it('reorderColumns should handle out of bounds gracefully', () => {
        useUiStore.setState({ visibleColumns: ['navn', 'orgnr'] })

        useUiStore.getState().reorderColumns(-1, 5)

        // Should not change
        expect(useUiStore.getState().visibleColumns).toEqual(['navn', 'orgnr'])
    })
})

describe('Recent Companies', () => {
    it('addRecentCompany should add company to list', () => {
        useUiStore.getState().addRecentCompany({
            orgnr: '123456789',
            navn: 'Test AS',
            organisasjonsform: 'AS',
        })

        const recent = useUiStore.getState().recentCompanies
        expect(recent).toHaveLength(1)
        expect(recent[0].orgnr).toBe('123456789')
        expect(recent[0].timestamp).toBeDefined()
    })

    it('addRecentCompany should move existing to front', () => {
        useUiStore.getState().addRecentCompany({ orgnr: '111', navn: 'First', organisasjonsform: 'AS' })
        useUiStore.getState().addRecentCompany({ orgnr: '222', navn: 'Second', organisasjonsform: 'AS' })
        useUiStore.getState().addRecentCompany({ orgnr: '111', navn: 'First Updated', organisasjonsform: 'AS' })

        const recent = useUiStore.getState().recentCompanies
        expect(recent).toHaveLength(2)
        expect(recent[0].orgnr).toBe('111')
        expect(recent[0].navn).toBe('First Updated')
    })

    it('addRecentCompany should limit to 6 items', () => {
        for (let i = 0; i < 10; i++) {
            useUiStore.getState().addRecentCompany({
                orgnr: `${i}`.padStart(9, '0'),
                navn: `Company ${i}`,
                organisasjonsform: 'AS',
            })
        }

        expect(useUiStore.getState().recentCompanies).toHaveLength(6)
    })

    it('clearRecentCompanies should empty the list', () => {
        useUiStore.getState().addRecentCompany({ orgnr: '123', navn: 'Test', organisasjonsform: 'AS' })
        useUiStore.getState().clearRecentCompanies()

        expect(useUiStore.getState().recentCompanies).toHaveLength(0)
    })
})

describe('Recent Searches', () => {
    it('addRecentSearch should add search to list', () => {
        useUiStore.getState().addRecentSearch('test query', 42)

        const searches = useUiStore.getState().recentSearches
        expect(searches).toHaveLength(1)
        expect(searches[0].query).toBe('test query')
        expect(searches[0].resultCount).toBe(42)
    })

    it('addRecentSearch should ignore empty queries', () => {
        useUiStore.getState().addRecentSearch('  ', 0)

        expect(useUiStore.getState().recentSearches).toHaveLength(0)
    })

    it('addRecentSearch should dedupe case-insensitively', () => {
        useUiStore.getState().addRecentSearch('Test', 10)
        useUiStore.getState().addRecentSearch('test', 20)

        const searches = useUiStore.getState().recentSearches
        expect(searches).toHaveLength(1)
        expect(searches[0].query).toBe('test')
    })

    it('addRecentSearch should limit to 10 items', () => {
        for (let i = 0; i < 15; i++) {
            useUiStore.getState().addRecentSearch(`query ${i}`)
        }

        expect(useUiStore.getState().recentSearches).toHaveLength(10)
    })

    it('clearRecentSearches should empty the list', () => {
        useUiStore.getState().addRecentSearch('test')
        useUiStore.getState().clearRecentSearches()

        expect(useUiStore.getState().recentSearches).toHaveLength(0)
    })
})

describe('Reset Action', () => {
    it('reset should clear page and year but keep preferences', () => {
        useUiStore.setState({
            currentPage: 5,
            selectedYear: 2023,
            viewMode: 'grid',
        })

        useUiStore.getState().reset()

        const state = useUiStore.getState()
        expect(state.currentPage).toBe(1)
        expect(state.selectedYear).toBeNull()
        expect(state.viewMode).toBe('grid') // Should be preserved
    })
})

describe('Column Config', () => {
    it('should have all required columns defined', () => {
        const requiredColumns: CompanyColumn[] = ['navn', 'orgnr', 'revenue', 'profit']

        requiredColumns.forEach((col) => {
            expect(COLUMN_CONFIG[col]).toBeDefined()
            expect(COLUMN_CONFIG[col].label).toBeDefined()
        })
    })
})
