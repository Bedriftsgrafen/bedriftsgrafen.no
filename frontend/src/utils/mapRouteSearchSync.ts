import { COUNTIES } from '../constants/explorer'
import { MUNICIPALITIES } from '../constants/municipalityCodes'
import type { FilterValues } from '../store/filterStore'
import { defaultMapFilters, type MapFilterValues } from '../types/map'
import { mnokToNok, nokToMnok } from './financials'

export type MapRouteMoneyUnit = 'nok' | 'mnok'

export interface MapRouteSearchFilters {
    q?: string
    nace?: string
    county?: string
    county_code?: string
    municipality?: string
    municipality_code?: string
    org_form?: string | string[]
    revenue_min?: number
    revenue_max?: number
    employee_min?: number
    employee_max?: number
    profit_min?: number
    profit_max?: number
    is_bankrupt?: boolean
    has_accounting?: boolean
    in_liquidation?: boolean
    in_forced_liquidation?: boolean
    show_per_capita?: boolean
}

export interface BuildMapRouteFilterUpdatesOptions {
    clearMissing?: boolean
    moneyUnit?: MapRouteMoneyUnit
    defaultOrganizationForms?: string[]
}

export interface BuildMapFiltersFromRouteSearchOptions {
    moneyUnit?: MapRouteMoneyUnit
    defaultOrganizationForms?: string[]
}

function normalizeOrgForms(value: string | string[] | undefined) {
    if (value === undefined) return undefined
    return (Array.isArray(value) ? value : [value]).filter(Boolean)
}

function arraysEqual(left: string[], right: string[]) {
    if (left.length !== right.length) return false
    return left.every((value, index) => value === right[index])
}

function resolveCountyCode(county: string | undefined, countyCode: string | undefined) {
    if (countyCode) return countyCode
    if (!county) return ''
    const match = COUNTIES.find((entry) => entry.code === county || entry.name.toLowerCase() === county.toLowerCase())
    return match?.code ?? ''
}

function resolveCountyName(county: string | undefined, countyCode: string | undefined) {
    if (county) return county
    if (!countyCode) return ''
    return COUNTIES.find((entry) => entry.code === countyCode)?.name ?? countyCode
}

function resolveMunicipalityCode(municipality: string | undefined, municipalityCode: string | undefined) {
    if (municipalityCode) return municipalityCode
    if (!municipality) return ''
    const match = MUNICIPALITIES.find((entry) => entry.name.toLowerCase() === municipality.toLowerCase())
    return match?.code ?? ''
}

function resolveMunicipalityName(municipality: string | undefined, municipalityCode: string | undefined) {
    if (municipality) return municipality
    if (!municipalityCode) return ''
    return MUNICIPALITIES.find((entry) => entry.code === municipalityCode)?.name ?? municipalityCode
}

function toStoreMoney(value: number | undefined, moneyUnit: MapRouteMoneyUnit) {
    if (value === undefined) return undefined
    return moneyUnit === 'mnok' ? mnokToNok(value) : value
}

function toRouteMoney(value: number | null | undefined, moneyUnit: MapRouteMoneyUnit) {
    if (value === null || value === undefined) return undefined
    return moneyUnit === 'mnok' ? nokToMnok(value) : value
}

function setStoreNumber(
    updates: Partial<FilterValues>,
    current: FilterValues,
    key: 'revenueMin' | 'revenueMax' | 'employeeMin' | 'employeeMax' | 'profitMin' | 'profitMax',
    value: number | undefined,
    clearMissing: boolean,
) {
    if (value !== undefined && current[key] !== value) {
        updates[key] = value
    } else if (clearMissing && value === undefined && current[key] !== null) {
        updates[key] = null
    }
}

function setStoreBoolean(
    updates: Partial<FilterValues>,
    current: FilterValues,
    key: 'isBankrupt' | 'hasAccounting' | 'inLiquidation' | 'inForcedLiquidation',
    value: boolean | undefined,
    clearMissing: boolean,
) {
    if (value !== undefined && current[key] !== value) {
        updates[key] = value
    } else if (clearMissing && value === undefined && current[key] !== null) {
        updates[key] = null
    }
}

export function buildMapRouteFilterUpdates(
    search: MapRouteSearchFilters,
    current: FilterValues,
    options: BuildMapRouteFilterUpdatesOptions = {},
): Partial<FilterValues> {
    const updates: Partial<FilterValues> = {}
    const { clearMissing = false, moneyUnit = 'nok', defaultOrganizationForms } = options

    if (search.q !== undefined && current.searchQuery !== search.q) {
        updates.searchQuery = search.q || ''
    } else if (clearMissing && search.q === undefined && current.searchQuery) {
        updates.searchQuery = ''
    }

    if (search.nace !== undefined && current.naeringskode !== search.nace) {
        updates.naeringskode = search.nace || ''
    } else if (clearMissing && search.nace === undefined && current.naeringskode) {
        updates.naeringskode = ''
    }

    const organizationForms = normalizeOrgForms(search.org_form)
    if (organizationForms !== undefined && !arraysEqual(current.organizationForms, organizationForms)) {
        updates.organizationForms = organizationForms
    } else if (clearMissing && organizationForms === undefined) {
        const nextOrganizationForms = defaultOrganizationForms ?? []
        if (!arraysEqual(current.organizationForms, nextOrganizationForms)) {
            updates.organizationForms = nextOrganizationForms
        }
    }

    const hasMunicipalityFilter = search.municipality !== undefined || search.municipality_code !== undefined
    const hasCountyFilter = search.county !== undefined || search.county_code !== undefined

    if (hasMunicipalityFilter) {
        const municipalityCode = resolveMunicipalityCode(search.municipality, search.municipality_code)
        const municipality = resolveMunicipalityName(search.municipality, search.municipality_code)

        if (current.municipalityCode !== municipalityCode) updates.municipalityCode = municipalityCode
        if (current.municipality !== municipality) updates.municipality = municipality
        if (current.countyCode) updates.countyCode = ''
        if (current.county) updates.county = ''
    } else if (hasCountyFilter) {
        const countyCode = resolveCountyCode(search.county, search.county_code)
        const county = resolveCountyName(search.county, search.county_code)

        if (current.countyCode !== countyCode) updates.countyCode = countyCode
        if (current.county !== county) updates.county = county
        if (current.municipalityCode) updates.municipalityCode = ''
        if (current.municipality) updates.municipality = ''
    } else if (clearMissing) {
        if (current.municipalityCode) updates.municipalityCode = ''
        if (current.municipality) updates.municipality = ''
        if (current.countyCode) updates.countyCode = ''
        if (current.county) updates.county = ''
    }

    setStoreNumber(updates, current, 'revenueMin', toStoreMoney(search.revenue_min, moneyUnit), clearMissing)
    setStoreNumber(updates, current, 'revenueMax', toStoreMoney(search.revenue_max, moneyUnit), clearMissing)
    setStoreNumber(updates, current, 'employeeMin', search.employee_min, clearMissing)
    setStoreNumber(updates, current, 'employeeMax', search.employee_max, clearMissing)
    setStoreNumber(updates, current, 'profitMin', toStoreMoney(search.profit_min, moneyUnit), clearMissing)
    setStoreNumber(updates, current, 'profitMax', toStoreMoney(search.profit_max, moneyUnit), clearMissing)
    setStoreBoolean(updates, current, 'isBankrupt', search.is_bankrupt, clearMissing)
    setStoreBoolean(updates, current, 'hasAccounting', search.has_accounting, clearMissing)
    setStoreBoolean(updates, current, 'inLiquidation', search.in_liquidation, clearMissing)
    setStoreBoolean(updates, current, 'inForcedLiquidation', search.in_forced_liquidation, clearMissing)

    return updates
}

export function buildMapFilterStoreUpdates(updates: Partial<MapFilterValues>): Partial<FilterValues> {
    const storeUpdates: Partial<FilterValues> = {}

    if ('query' in updates) storeUpdates.searchQuery = updates.query || ''
    if ('naceCode' in updates) storeUpdates.naeringskode = updates.naceCode || ''

    const nextCountyCode = 'countyCode' in updates ? updates.countyCode || '' : undefined
    const nextMunicipalityCode = 'municipalityCode' in updates ? updates.municipalityCode || '' : undefined

    if (nextMunicipalityCode) {
        storeUpdates.municipalityCode = nextMunicipalityCode
        storeUpdates.municipality = resolveMunicipalityName(undefined, nextMunicipalityCode)
        storeUpdates.countyCode = ''
        storeUpdates.county = ''
    } else if (nextCountyCode) {
        storeUpdates.countyCode = nextCountyCode
        storeUpdates.county = resolveCountyName(undefined, nextCountyCode)
        storeUpdates.municipalityCode = ''
        storeUpdates.municipality = ''
    } else if ('countyCode' in updates || 'municipalityCode' in updates) {
        if ('countyCode' in updates) {
            storeUpdates.countyCode = ''
            storeUpdates.county = ''
        }
        if ('municipalityCode' in updates) {
            storeUpdates.municipalityCode = ''
            storeUpdates.municipality = ''
        }
    }

    if ('revenueMin' in updates) storeUpdates.revenueMin = updates.revenueMin
    if ('revenueMax' in updates) storeUpdates.revenueMax = updates.revenueMax
    if ('employeeMin' in updates) storeUpdates.employeeMin = updates.employeeMin
    if ('employeeMax' in updates) storeUpdates.employeeMax = updates.employeeMax
    if ('profitMin' in updates) storeUpdates.profitMin = updates.profitMin
    if ('profitMax' in updates) storeUpdates.profitMax = updates.profitMax
    if ('organizationForms' in updates) storeUpdates.organizationForms = updates.organizationForms || []
    if ('isBankrupt' in updates) storeUpdates.isBankrupt = updates.isBankrupt
    if ('hasAccounting' in updates) storeUpdates.hasAccounting = updates.hasAccounting
    if ('inLiquidation' in updates) storeUpdates.inLiquidation = updates.inLiquidation
    if ('inForcedLiquidation' in updates) storeUpdates.inForcedLiquidation = updates.inForcedLiquidation

    return storeUpdates
}

export function buildMapRouteSearchUpdates(
    updates: Partial<MapFilterValues>,
    options: { moneyUnit?: MapRouteMoneyUnit } = {},
): Partial<MapRouteSearchFilters> {
    const searchUpdates: Partial<MapRouteSearchFilters> = {}
    const { moneyUnit = 'nok' } = options

    if ('query' in updates) searchUpdates.q = updates.query || undefined
    if ('naceCode' in updates) searchUpdates.nace = updates.naceCode || undefined

    const nextCountyCode = 'countyCode' in updates ? updates.countyCode || '' : undefined
    const nextMunicipalityCode = 'municipalityCode' in updates ? updates.municipalityCode || '' : undefined

    if (nextMunicipalityCode) {
        searchUpdates.municipality_code = nextMunicipalityCode
        searchUpdates.municipality = resolveMunicipalityName(undefined, nextMunicipalityCode)
        searchUpdates.county_code = undefined
        searchUpdates.county = undefined
    } else if (nextCountyCode) {
        searchUpdates.county_code = nextCountyCode
        searchUpdates.county = resolveCountyName(undefined, nextCountyCode)
        searchUpdates.municipality_code = undefined
        searchUpdates.municipality = undefined
    } else if ('countyCode' in updates || 'municipalityCode' in updates) {
        if ('countyCode' in updates) {
            searchUpdates.county_code = undefined
            searchUpdates.county = undefined
        }
        if ('municipalityCode' in updates) {
            searchUpdates.municipality_code = undefined
            searchUpdates.municipality = undefined
        }
    }

    if ('organizationForms' in updates) searchUpdates.org_form = updates.organizationForms?.length ? updates.organizationForms : undefined
    if ('revenueMin' in updates) searchUpdates.revenue_min = toRouteMoney(updates.revenueMin, moneyUnit)
    if ('revenueMax' in updates) searchUpdates.revenue_max = toRouteMoney(updates.revenueMax, moneyUnit)
    if ('employeeMin' in updates) searchUpdates.employee_min = updates.employeeMin ?? undefined
    if ('employeeMax' in updates) searchUpdates.employee_max = updates.employeeMax ?? undefined
    if ('profitMin' in updates) searchUpdates.profit_min = toRouteMoney(updates.profitMin, moneyUnit)
    if ('profitMax' in updates) searchUpdates.profit_max = toRouteMoney(updates.profitMax, moneyUnit)
    if ('isBankrupt' in updates) searchUpdates.is_bankrupt = updates.isBankrupt ?? undefined
    if ('hasAccounting' in updates) searchUpdates.has_accounting = updates.hasAccounting ?? undefined
    if ('inLiquidation' in updates) searchUpdates.in_liquidation = updates.inLiquidation ?? undefined
    if ('inForcedLiquidation' in updates) searchUpdates.in_forced_liquidation = updates.inForcedLiquidation ?? undefined
    if ('showPerCapita' in updates) searchUpdates.show_per_capita = updates.showPerCapita ? true : undefined

    return searchUpdates
}

export function buildMapFiltersFromRouteSearch(
    search: MapRouteSearchFilters,
    options: BuildMapFiltersFromRouteSearchOptions = {},
): MapFilterValues {
    const { moneyUnit = 'nok', defaultOrganizationForms = [] } = options
    const municipalityCode = resolveMunicipalityCode(search.municipality, search.municipality_code)
    const countyCode = municipalityCode ? '' : resolveCountyCode(search.county, search.county_code)

    return {
        ...defaultMapFilters,
        query: search.q || null,
        naceCode: search.nace || null,
        countyCode: countyCode || null,
        municipalityCode: municipalityCode || null,
        organizationForms: normalizeOrgForms(search.org_form) ?? defaultOrganizationForms,
        revenueMin: toStoreMoney(search.revenue_min, moneyUnit) ?? null,
        revenueMax: toStoreMoney(search.revenue_max, moneyUnit) ?? null,
        employeeMin: search.employee_min ?? null,
        employeeMax: search.employee_max ?? null,
        profitMin: toStoreMoney(search.profit_min, moneyUnit) ?? null,
        profitMax: toStoreMoney(search.profit_max, moneyUnit) ?? null,
        isBankrupt: search.is_bankrupt ?? null,
        hasAccounting: search.has_accounting ?? null,
        inLiquidation: search.in_liquidation ?? null,
        inForcedLiquidation: search.in_forced_liquidation ?? null,
        showPerCapita: search.show_per_capita ?? false,
    }
}