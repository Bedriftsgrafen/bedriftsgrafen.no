import { describe, expect, it } from 'vitest'
import { buildBransjerRouteFilterUpdates } from '../../utils/bransjerSearchSync'
import type { FilterValues } from '../../store/filterStore'

const emptyFilters: FilterValues = {
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
    sortBy: 'navn',
    sortOrder: 'asc',
}

describe('buildBransjerRouteFilterUpdates', () => {
    it('hydrates NACE from Virksomheter links into the explorer filter store', () => {
        expect(buildBransjerRouteFilterUpdates({ nace: '58.11' }, emptyFilters)).toEqual({
            naeringskode: '58.11',
        })
    })

    it('does not rewrite filters when the URL already matches the store', () => {
        expect(buildBransjerRouteFilterUpdates(
            { nace: '58.11' },
            { ...emptyFilters, naeringskode: '58.11' },
        )).toEqual({})
    })

    it('maps route location params and clears stale broader location filters', () => {
        expect(buildBransjerRouteFilterUpdates(
            { municipality_code: '0301' },
            { ...emptyFilters, county: 'Oslo', countyCode: '03' },
        )).toEqual({
            municipality: 'OSLO',
            municipalityCode: '0301',
            county: '',
            countyCode: '',
        })
    })
})