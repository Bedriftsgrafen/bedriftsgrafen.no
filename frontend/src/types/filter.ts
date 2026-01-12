/**
 * Filter-related types for company search and filtering
 */

export interface OrganizationFormOption {
  value: string
  label: string
}

export interface FilterState {
  searchQuery: string
  organizationForms: string[]
  naeringskode: string
  revenueMin: number | null
  revenueMax: number | null
  profitMin: number | null
  profitMax: number | null
  equityMin: number | null
  equityMax: number | null
  operatingProfitMin: number | null
  operatingProfitMax: number | null
  liquidityRatioMin: number | null
  liquidityRatioMax: number | null
  equityRatioMin: number | null
  equityRatioMax: number | null
  employeeMin: number | null
  employeeMax: number | null
  municipality: string
  county: string
  foundedFrom: Date | null
  foundedTo: Date | null
  bankruptFrom: Date | null
  bankruptTo: Date | null
  isBankrupt: boolean | null
  inLiquidation: boolean | null
  inForcedLiquidation: boolean | null
  hasAccounting: boolean | null
}

// Note: SavedFilter type is defined in savedFiltersStore.ts to keep persistence types together

export type SortOrder = 'asc' | 'desc'

export type SortField =
  | 'navn'
  | 'orgnr'
  | 'organisasjonsform'
  | 'revenue'
  | 'profit'
  | 'antall_ansatte'
  | 'operating_profit'
