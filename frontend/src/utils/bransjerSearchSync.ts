import { COUNTIES } from '../constants/explorer'
import { MUNICIPALITIES } from '../constants/municipalityCodes'
import type { FilterValues } from '../store/filterStore'

export interface BransjerRouteSearchFilters {
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
}

interface BuildBransjerRouteFilterUpdatesOptions {
    clearMissing?: boolean
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

export function buildBransjerRouteFilterUpdates(
    search: BransjerRouteSearchFilters,
    current: FilterValues,
    options: BuildBransjerRouteFilterUpdatesOptions = {},
): Partial<FilterValues> {
    const updates: Partial<FilterValues> = {}
    const { clearMissing = false } = options

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
    } else if (clearMissing && organizationForms === undefined && current.organizationForms.length > 0) {
        updates.organizationForms = []
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

    if (search.revenue_min !== undefined && current.revenueMin !== search.revenue_min) updates.revenueMin = search.revenue_min
    else if (clearMissing && search.revenue_min === undefined && current.revenueMin !== null) updates.revenueMin = null
    if (search.revenue_max !== undefined && current.revenueMax !== search.revenue_max) updates.revenueMax = search.revenue_max
    else if (clearMissing && search.revenue_max === undefined && current.revenueMax !== null) updates.revenueMax = null
    if (search.employee_min !== undefined && current.employeeMin !== search.employee_min) updates.employeeMin = search.employee_min
    else if (clearMissing && search.employee_min === undefined && current.employeeMin !== null) updates.employeeMin = null
    if (search.employee_max !== undefined && current.employeeMax !== search.employee_max) updates.employeeMax = search.employee_max
    else if (clearMissing && search.employee_max === undefined && current.employeeMax !== null) updates.employeeMax = null
    if (search.profit_min !== undefined && current.profitMin !== search.profit_min) updates.profitMin = search.profit_min
    else if (clearMissing && search.profit_min === undefined && current.profitMin !== null) updates.profitMin = null
    if (search.profit_max !== undefined && current.profitMax !== search.profit_max) updates.profitMax = search.profit_max
    else if (clearMissing && search.profit_max === undefined && current.profitMax !== null) updates.profitMax = null
    if (search.is_bankrupt !== undefined && current.isBankrupt !== search.is_bankrupt) updates.isBankrupt = search.is_bankrupt
    else if (clearMissing && search.is_bankrupt === undefined && current.isBankrupt !== null) updates.isBankrupt = null
    if (search.has_accounting !== undefined && current.hasAccounting !== search.has_accounting) updates.hasAccounting = search.has_accounting
    else if (clearMissing && search.has_accounting === undefined && current.hasAccounting !== null) updates.hasAccounting = null
    if (search.in_liquidation !== undefined && current.inLiquidation !== search.in_liquidation) updates.inLiquidation = search.in_liquidation
    else if (clearMissing && search.in_liquidation === undefined && current.inLiquidation !== null) updates.inLiquidation = null
    if (search.in_forced_liquidation !== undefined && current.inForcedLiquidation !== search.in_forced_liquidation) {
        updates.inForcedLiquidation = search.in_forced_liquidation
    } else if (clearMissing && search.in_forced_liquidation === undefined && current.inForcedLiquidation !== null) {
        updates.inForcedLiquidation = null
    }

    return updates
}