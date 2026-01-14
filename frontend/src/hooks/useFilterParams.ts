import { useMemo } from 'react'
import { useFilterStore } from '../store/filterStore'

/**
 * Hook that returns filter parameters for API queries
 * Centralizes filter state transformation to prevent duplication
 */
export function useFilterParams() {
  const organizationForms = useFilterStore(s => s.organizationForms)
  const naeringskode = useFilterStore(s => s.naeringskode)
  const revenueMin = useFilterStore(s => s.revenueMin)
  const revenueMax = useFilterStore(s => s.revenueMax)
  const profitMin = useFilterStore(s => s.profitMin)
  const profitMax = useFilterStore(s => s.profitMax)
  const equityMin = useFilterStore(s => s.equityMin)
  const equityMax = useFilterStore(s => s.equityMax)
  const operatingProfitMin = useFilterStore(s => s.operatingProfitMin)
  const operatingProfitMax = useFilterStore(s => s.operatingProfitMax)
  const liquidityRatioMin = useFilterStore(s => s.liquidityRatioMin)
  const liquidityRatioMax = useFilterStore(s => s.liquidityRatioMax)
  const equityRatioMin = useFilterStore(s => s.equityRatioMin)
  const equityRatioMax = useFilterStore(s => s.equityRatioMax)
  const employeeMin = useFilterStore(s => s.employeeMin)
  const employeeMax = useFilterStore(s => s.employeeMax)
  const municipality = useFilterStore(s => s.municipality)
  const county = useFilterStore(s => s.county)
  const foundedFrom = useFilterStore(s => s.foundedFrom)
  const foundedTo = useFilterStore(s => s.foundedTo)
  const bankruptFrom = useFilterStore(s => s.bankruptFrom)
  const bankruptTo = useFilterStore(s => s.bankruptTo)
  const isBankrupt = useFilterStore(s => s.isBankrupt)
  const inLiquidation = useFilterStore(s => s.inLiquidation)
  const inForcedLiquidation = useFilterStore(s => s.inForcedLiquidation)
  const hasAccounting = useFilterStore(s => s.hasAccounting)
  const sortBy = useFilterStore(s => s.sortBy)
  const sortOrder = useFilterStore(s => s.sortOrder)
  const searchQuery = useFilterStore(s => s.searchQuery)

  // Memoize the filter params object to prevent unnecessary re-renders
  // Validation constraints from backend (companies.py Query params):
  // - employees: ge=0
  // - revenue/equity: ge=0
  // - profit/operating_profit: no constraints (can be negative)
  // - liquidity_ratio: ge=0
  // - equity_ratio: ge=0, le=1
  const filterParams = useMemo(() => ({
    name: searchQuery || undefined,
    organisasjonsform: organizationForms,
    naeringskode: naeringskode || undefined,
    // Revenue/equity must be non-negative
    min_revenue: revenueMin !== null ? Math.max(0, revenueMin) : undefined,
    max_revenue: revenueMax !== null ? Math.max(0, revenueMax) : undefined,
    // Profit can be negative (no backend constraint)
    min_profit: profitMin ?? undefined,
    max_profit: profitMax ?? undefined,
    // Equity must be non-negative
    min_equity: equityMin !== null ? Math.max(0, equityMin) : undefined,
    max_equity: equityMax !== null ? Math.max(0, equityMax) : undefined,
    // Operating profit can be negative
    min_operating_profit: operatingProfitMin ?? undefined,
    max_operating_profit: operatingProfitMax ?? undefined,
    // Liquidity ratio must be non-negative
    min_liquidity_ratio: liquidityRatioMin !== null ? Math.max(0, liquidityRatioMin) : undefined,
    max_liquidity_ratio: liquidityRatioMax !== null ? Math.max(0, liquidityRatioMax) : undefined,
    // Equity ratio must be 0-1
    min_equity_ratio: equityRatioMin !== null ? Math.min(1, Math.max(0, equityRatioMin)) : undefined,
    max_equity_ratio: equityRatioMax !== null ? Math.min(1, Math.max(0, equityRatioMax)) : undefined,
    // Employees must be non-negative
    min_employees: employeeMin !== null ? Math.max(0, employeeMin) : undefined,
    max_employees: employeeMax !== null ? Math.max(0, employeeMax) : undefined,
    municipality: municipality || undefined,
    county: county || undefined,
    founded_from: foundedFrom?.toISOString().split('T')[0],
    founded_to: foundedTo?.toISOString().split('T')[0],
    bankrupt_from: bankruptFrom?.toISOString().split('T')[0],
    bankrupt_to: bankruptTo?.toISOString().split('T')[0],
    is_bankrupt: isBankrupt ?? undefined,
    in_liquidation: inLiquidation ?? undefined,
    in_forced_liquidation: inForcedLiquidation ?? undefined,
    has_accounting: hasAccounting ?? undefined
  }), [
    searchQuery,
    organizationForms,
    naeringskode,
    revenueMin,
    revenueMax,
    profitMin,
    profitMax,
    equityMin,
    equityMax,
    operatingProfitMin,
    operatingProfitMax,
    liquidityRatioMin,
    liquidityRatioMax,
    equityRatioMin,
    equityRatioMax,
    employeeMin,
    employeeMax,
    municipality,
    county,
    foundedFrom,
    foundedTo,
    bankruptFrom,
    bankruptTo,
    isBankrupt,
    inLiquidation,
    inForcedLiquidation,
    hasAccounting
  ])

  return {
    filterParams,
    sortBy,
    sortOrder,
    searchQuery
  }
}
