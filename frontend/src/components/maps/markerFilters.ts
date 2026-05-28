interface MarkerFilterInput {
    naceCode?: string | null
    countyCode?: string | null
    municipalityCode?: string | null
    organizationForms?: string[]
    revenueMin?: number | null
    revenueMax?: number | null
    profitMin?: number | null
    profitMax?: number | null
    equityMin?: number | null
    equityMax?: number | null
    operatingProfitMin?: number | null
    operatingProfitMax?: number | null
    liquidityRatioMin?: number | null
    liquidityRatioMax?: number | null
    equityRatioMin?: number | null
    equityRatioMax?: number | null
    employeeMin?: number | null
    employeeMax?: number | null
    foundedFrom?: string | null
    foundedTo?: string | null
    bankruptFrom?: string | null
    bankruptTo?: string | null
    registeredFrom?: string | null
    registeredTo?: string | null
    isBankrupt?: boolean | null
    inLiquidation?: boolean | null
    inForcedLiquidation?: boolean | null
    hasAccounting?: boolean | null
    query?: string | null
}

export function hasMarkerFilters(filters: MarkerFilterInput) {
    const hasActiveRangeFilters = [
        filters.revenueMin,
        filters.revenueMax,
        filters.profitMin,
        filters.profitMax,
        filters.equityMin,
        filters.equityMax,
        filters.operatingProfitMin,
        filters.operatingProfitMax,
        filters.liquidityRatioMin,
        filters.liquidityRatioMax,
        filters.equityRatioMin,
        filters.equityRatioMax,
        filters.employeeMin,
        filters.employeeMax,
    ].some((value) => value !== null && value !== undefined)
    const hasActiveDateFilters = Boolean(
        filters.foundedFrom || filters.foundedTo || filters.bankruptFrom || filters.bankruptTo ||
        filters.registeredFrom || filters.registeredTo,
    )
    const hasActiveStatusFilters = [
        filters.isBankrupt,
        filters.inLiquidation,
        filters.inForcedLiquidation,
        filters.hasAccounting,
    ].some((value) => value !== null && value !== undefined)

    return Boolean(
        filters.naceCode || filters.query || filters.municipalityCode || filters.countyCode ||
        filters.organizationForms?.length || hasActiveRangeFilters || hasActiveDateFilters || hasActiveStatusFilters,
    )
}