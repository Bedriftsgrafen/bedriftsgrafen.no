import { describe, expect, it } from 'vitest'
import type { FilterValues } from '../../store/filterStore'
import {
    buildMapFilterStoreUpdates,
    buildMapFiltersFromRouteSearch,
    buildMapRouteFilterUpdates,
    buildMapRouteSearchUpdates,
} from '../mapRouteSearchSync'

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

describe('mapRouteSearchSync', () => {
    it('hydrates MNOK route values into NOK store filters without losing false booleans', () => {
        expect(buildMapRouteFilterUpdates(
            { revenue_min: 12.5, has_accounting: false },
            emptyFilters,
            { moneyUnit: 'mnok' },
        )).toEqual({
            revenueMin: 12_500_000,
            hasAccounting: false,
        })
    })

    it('makes municipality filters win over stale county filters', () => {
        expect(buildMapRouteFilterUpdates(
            { municipality_code: '0301' },
            { ...emptyFilters, county: 'Oslo', countyCode: '03' },
        )).toEqual({
            municipality: 'OSLO',
            municipalityCode: '0301',
            county: '',
            countyCode: '',
        })
    })

    it('applies route defaults when missing params are authoritative', () => {
        expect(buildMapRouteFilterUpdates(
            {},
            { ...emptyFilters, organizationForms: ['ASA'], searchQuery: 'bygg' },
            { clearMissing: true, defaultOrganizationForms: ['AS'] },
        )).toEqual({
            searchQuery: '',
            organizationForms: ['AS'],
        })
    })

    it('builds atomic store updates for county selection even when a null municipality key is present', () => {
        expect(buildMapFilterStoreUpdates({ countyCode: '03', municipalityCode: null })).toEqual({
            county: 'Oslo',
            countyCode: '03',
            municipality: '',
            municipalityCode: '',
        })
    })

    it('builds URL updates with MNOK values and preserves false boolean filters', () => {
        expect(buildMapRouteSearchUpdates(
            { revenueMin: 12_500_000, hasAccounting: false, showPerCapita: true },
            { moneyUnit: 'mnok' },
        )).toEqual({
            revenue_min: 12.5,
            has_accounting: false,
            show_per_capita: true,
        })
    })

    it('maps route search into local map filters with municipality taking precedence', () => {
        expect(buildMapFiltersFromRouteSearch({
            county_code: '03',
            municipality_code: '0301',
            revenue_min: 2,
            show_per_capita: true,
        }, { moneyUnit: 'mnok' })).toMatchObject({
            countyCode: null,
            municipalityCode: '0301',
            revenueMin: 2_000_000,
            showPerCapita: true,
        })
    })
})