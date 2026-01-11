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
  naceCodes: string[]
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
  foundedFrom: Date | null
  foundedTo: Date | null
  isBankrupt: boolean | null
  inLiquidation: boolean | null
  inForcedLiquidation: boolean | null
  yearFrom: number | null
  yearTo: number | null
  hasAccounting: boolean | null
}

export interface SavedFilter {
  id: string
  name: string
  createdAt: number
  filters: Partial<FilterState>
}

export type SortOrder = 'asc' | 'desc'

export type SortField = 
  | 'navn' 
  | 'orgnr' 
  | 'organisasjonsform' 
  | 'revenue' 
  | 'profit' 
  | 'antall_ansatte'
  | 'operating_profit'
