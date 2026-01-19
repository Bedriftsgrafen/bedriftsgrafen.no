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
            expect(state.naeringskode).toBe('')
            expect(state.revenueMin).toBeNull()
            expect(state.revenueMax).toBeNull()
            expect(state.profitMin).toBeNull()
            expect(state.profitMax).toBeNull()
            expect(state.equityMin).toBeNull()
            expect(state.equityMax).toBeNull()
            expect(state.operatingProfitMin).toBeNull()
            expect(state.operatingProfitMax).toBeNull()
            expect(state.liquidityRatioMin).toBeNull()
            expect(state.liquidityRatioMax).toBeNull()
            expect(state.equityRatioMin).toBeNull()
            expect(state.equityRatioMax).toBeNull()
            expect(state.employeeMin).toBeNull()
            expect(state.employeeMax).toBeNull()
            expect(state.municipality).toBe('')
            expect(state.county).toBe('')
            expect(state.foundedFrom).toBeNull()
            expect(state.foundedTo).toBeNull()
            expect(state.bankruptFrom).toBeNull()
            expect(state.bankruptTo).toBeNull()
            expect(state.isBankrupt).toBeNull()
            expect(state.inLiquidation).toBeNull()
            expect(state.inForcedLiquidation).toBeNull()
            expect(state.hasAccounting).toBeNull()
            expect(state.sortBy).toBe('navn')
            expect(state.sortOrder).toBe('asc')
            expect(state.filterVersion).toBeGreaterThanOrEqual(0)
        })
    })

    describe('actions', () => {
        it('setSearchQuery updates search query', () => {
            useFilterStore.getState().setSearchQuery('test company')
            expect(useFilterStore.getState().searchQuery).toBe('test company')
        })

        it('setOrganizationForms updates organization forms array', () => {
            useFilterStore.getState().setOrganizationForms(['AS', 'ASA'])
            expect(useFilterStore.getState().organizationForms).toEqual(['AS', 'ASA'])
        })

        it('setNaeringskode updates industry code', () => {
            useFilterStore.getState().setNaeringskode('62.100')
            expect(useFilterStore.getState().naeringskode).toBe('62.100')
        })

        it('setRevenueRange sets min and max revenue', () => {
            useFilterStore.getState().setRevenueRange(1000000, 5000000)
            const state = useFilterStore.getState()
            expect(state.revenueMin).toBe(1000000)
            expect(state.revenueMax).toBe(5000000)
        })

        it('setProfitRange sets profit range', () => {
            useFilterStore.getState().setProfitRange(500, 1000)
            expect(useFilterStore.getState().profitMin).toBe(500)
            expect(useFilterStore.getState().profitMax).toBe(1000)
        })

        it('setLiquidityRatioRange sets liquidity ratio range', () => {
            useFilterStore.getState().setLiquidityRatioRange(0.5, 2.0)
            expect(useFilterStore.getState().liquidityRatioMin).toBe(0.5)
            expect(useFilterStore.getState().liquidityRatioMax).toBe(2.0)
        })

        it('setMunicipality and setCounty update location and clear each other', () => {
            useFilterStore.getState().setMunicipality('Oslo', '0301')
            expect(useFilterStore.getState().municipality).toBe('Oslo')

            useFilterStore.getState().setCounty('Oslo', '03')
            expect(useFilterStore.getState().municipality).toBe('') // Cleared
            expect(useFilterStore.getState().county).toBe('Oslo')
        })

        it('setFoundedRange updates date range', () => {
            const from = new Date('2020-01-01')
            const to = new Date('2023-01-01')
            useFilterStore.getState().setFoundedRange(from, to)
            expect(useFilterStore.getState().foundedFrom).toEqual(from)
            expect(useFilterStore.getState().foundedTo).toEqual(to)
        })

        it('setStatus updates various status flags', () => {
            useFilterStore.getState().setStatus('isBankrupt', true)
            useFilterStore.getState().setStatus('inLiquidation', false)
            expect(useFilterStore.getState().isBankrupt).toBe(true)
            expect(useFilterStore.getState().inLiquidation).toBe(false)
        })

        it('setHasAccounting updates accounting flag', () => {
            useFilterStore.getState().setHasAccounting(true)
            expect(useFilterStore.getState().hasAccounting).toBe(true)
        })

        it('setSort updates sort by and order', () => {
            useFilterStore.getState().setSort('revenue', 'desc')
            const state = useFilterStore.getState()
            expect(state.sortBy).toBe('revenue')
            expect(state.sortOrder).toBe('desc')
        })

        it('setAllFilters updates multiple filters and increments version', () => {
            const initialVersion = useFilterStore.getState().filterVersion
            useFilterStore.getState().setAllFilters({
                searchQuery: 'bulk test',
                revenueMin: 100
            })
            const state = useFilterStore.getState()
            expect(state.searchQuery).toBe('bulk test')
            expect(state.revenueMin).toBe(100)
            expect(state.filterVersion).toBe(initialVersion + 1)
        })
    })

    describe('clearFilters', () => {
        it('resets ALL filters to defaults', () => {
            // Set many filters
            const store = useFilterStore.getState()
            store.setSearchQuery('test')
            store.setOrganizationForms(['AS'])
            store.setNaeringskode('62')
            store.setRevenueRange(1, 10)
            store.setProfitRange(1, 10)
            store.setLiquidityRatioRange(0.1, 0.9)
            store.setMunicipality('Oslo', '0301')
            store.setStatus('isBankrupt', true)
            store.setHasAccounting(true)
            store.setSort('revenue', 'desc')

            // Clear
            store.clearFilters()

            // Verify reset of random sample of fields
            const state = useFilterStore.getState()
            expect(state.searchQuery).toBe('')
            expect(state.naeringskode).toBe('')
            expect(state.revenueMin).toBeNull()
            expect(state.profitMax).toBeNull()
            expect(state.liquidityRatioMin).toBeNull()
            expect(state.municipality).toBe('')
            expect(state.isBankrupt).toBeNull()
            expect(state.hasAccounting).toBeNull()
            expect(state.sortBy).toBe('navn')
            expect(state.sortOrder).toBe('asc')
            expect(state.filterVersion).toBeGreaterThan(0)
        })
    })

    describe('getActiveFilterCount', () => {
        it('returns 0 for default state', () => {
            expect(useFilterStore.getState().getActiveFilterCount()).toBe(0)
        })

        it('counts range as 1 filter even if both min and max are set', () => {
            useFilterStore.getState().setRevenueRange(100, 500)
            expect(useFilterStore.getState().getActiveFilterCount()).toBe(1)
        })

        it('counts multiple financial and status filters correctly', () => {
            const store = useFilterStore.getState()
            store.setSearchQuery('test')         // 1
            store.setOrganizationForms(['AS'])   // 2
            store.setRevenueRange(100, null)     // 3
            store.setLiquidityRatioRange(null, 2)// 4
            store.setStatus('isBankrupt', true)  // 5
            store.setHasAccounting(false)        // 6
            expect(store.getActiveFilterCount()).toBe(6)
        })

        it('counts locations and dates correctly', () => {
            const store = useFilterStore.getState()
            store.setSearchQuery('test')                // 1
            store.setCounty('Oslo', '03')               // 3 (county name + code, clears municipality)
            expect(store.getActiveFilterCount()).toBe(3)
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
