import { create } from 'zustand'

/**
 * Filter values - data only, no functions
 * Used for setAllFilters to ensure type safety
 */
export interface FilterValues {
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
  municipalityCode: string
  county: string
  countyCode: string
  foundedFrom: Date | null
  foundedTo: Date | null
  bankruptFrom: Date | null
  bankruptTo: Date | null
  isBankrupt: boolean | null
  inLiquidation: boolean | null
  inForcedLiquidation: boolean | null
  hasAccounting: boolean | null
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

/**
 * Filter actions - functions for modifying state
 */
interface FilterActions {
  setSearchQuery: (query: string) => void
  setOrganizationForms: (forms: string[]) => void
  setNaeringskode: (code: string) => void
  setRevenueRange: (min: number | null, max: number | null) => void
  setProfitRange: (min: number | null, max: number | null) => void
  setEquityRange: (min: number | null, max: number | null) => void
  setOperatingProfitRange: (min: number | null, max: number | null) => void
  setLiquidityRatioRange: (min: number | null, max: number | null) => void
  setEquityRatioRange: (min: number | null, max: number | null) => void
  setEmployeeRange: (min: number | null, max: number | null) => void
  setMunicipality: (name: string, code: string) => void
  setMunicipalityCode: (code: string) => void
  setCounty: (name: string, code: string) => void
  setCountyCode: (code: string) => void
  setFoundedRange: (from: Date | null, to: Date | null) => void
  setBankruptRange: (from: Date | null, to: Date | null) => void
  setStatus: (key: 'isBankrupt' | 'inLiquidation' | 'inForcedLiquidation', value: boolean | null) => void
  setHasAccounting: (has: boolean | null) => void
  setSort: (by: string, order: 'asc' | 'desc') => void
  setAllFilters: (filters: Partial<FilterValues>) => void
  setMapFilters: (filters: Partial<FilterValues>) => void
  clearFilters: () => void
  incrementFilterVersion: () => void
  getActiveFilterCount: () => number
}

/**
 * Complete filter state combining values, metadata, and actions
 */
interface FilterState extends FilterValues, FilterActions {
  // Version counter - increments on clearFilters to force UI re-sync
  filterVersion: number
}

export const useFilterStore = create<FilterState>((set, get) => ({
  // Initial state
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
  filterVersion: 0,

  // Actions
  setSearchQuery: (query) => set((s) => ({ searchQuery: query, filterVersion: s.filterVersion + 1 })),
  setOrganizationForms: (forms) => set((s) => ({ organizationForms: forms, filterVersion: s.filterVersion + 1 })),
  setNaeringskode: (code) => set((s) => ({ naeringskode: code, filterVersion: s.filterVersion + 1 })),
  setRevenueRange: (min, max) => set((s) => ({ revenueMin: min, revenueMax: max, filterVersion: s.filterVersion + 1 })),
  setProfitRange: (min, max) => set((s) => ({ profitMin: min, profitMax: max, filterVersion: s.filterVersion + 1 })),
  setEquityRange: (min, max) => set((s) => ({ equityMin: min, equityMax: max, filterVersion: s.filterVersion + 1 })),
  setOperatingProfitRange: (min, max) => set((s) => ({ operatingProfitMin: min, operatingProfitMax: max, filterVersion: s.filterVersion + 1 })),
  setLiquidityRatioRange: (min, max) => set((s) => ({ liquidityRatioMin: min, liquidityRatioMax: max, filterVersion: s.filterVersion + 1 })),
  setEquityRatioRange: (min, max) => set((s) => ({ equityRatioMin: min, equityRatioMax: max, filterVersion: s.filterVersion + 1 })),
  setEmployeeRange: (min, max) => set((s) => ({ employeeMin: min, employeeMax: max, filterVersion: s.filterVersion + 1 })),
  setMunicipality: (name, code) => set((s) => ({ municipality: name, municipalityCode: code, county: '', countyCode: '', filterVersion: s.filterVersion + 1 })),
  setMunicipalityCode: (c) => set((s) => ({ municipalityCode: c, filterVersion: s.filterVersion + 1 })),
  setCounty: (name, code) => set((s) => ({ county: name, countyCode: code, municipality: '', municipalityCode: '', filterVersion: s.filterVersion + 1 })),
  setCountyCode: (c) => set((s) => ({ countyCode: c, filterVersion: s.filterVersion + 1 })),
  setFoundedRange: (from, to) => set((s) => ({ foundedFrom: from, foundedTo: to, filterVersion: s.filterVersion + 1 })),
  setBankruptRange: (from, to) => set((s) => ({ bankruptFrom: from, bankruptTo: to, filterVersion: s.filterVersion + 1 })),
  setStatus: (key, value) => set((s) => ({ [key]: value, filterVersion: s.filterVersion + 1 })),
  setHasAccounting: (has) => set((s) => ({ hasAccounting: has, filterVersion: s.filterVersion + 1 })),
  setSort: (by, order) => set({ sortBy: by, sortOrder: order }), // Sort doesn't need to trigger FilterPanel draft re-sync
  setAllFilters: (filters) => set((state) => ({ ...filters, filterVersion: state.filterVersion + 1 })),
  setMapFilters: (filters) => set((state) => ({
    // Clear location fields first to avoid stale filters
    municipality: '',
    municipalityCode: '',
    county: '',
    countyCode: '',
    naeringskode: '',
    // Apply new map filters
    ...filters,
    filterVersion: state.filterVersion + 1,
  })),
  incrementFilterVersion: () => set((state) => ({ filterVersion: state.filterVersion + 1 })),
  clearFilters: () => set((state) => ({
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
    filterVersion: state.filterVersion + 1, // Trigger UI sync
  })),
  getActiveFilterCount: () => {
    const state = get()
    let count = 0
    if (state.searchQuery) count++
    if (state.organizationForms.length > 0) count++
    if (state.naeringskode) count++
    if (state.revenueMin !== null || state.revenueMax !== null) count++
    if (state.profitMin !== null || state.profitMax !== null) count++
    if (state.equityMin !== null || state.equityMax !== null) count++
    if (state.operatingProfitMin !== null || state.operatingProfitMax !== null) count++
    if (state.liquidityRatioMin !== null || state.liquidityRatioMax !== null) count++
    if (state.equityRatioMin !== null || state.equityRatioMax !== null) count++
    if (state.employeeMin !== null || state.employeeMax !== null) count++
    if (state.municipality) count++
    if (state.municipalityCode) count++
    if (state.county) count++
    if (state.foundedFrom !== null || state.foundedTo !== null) count++
    if (state.bankruptFrom !== null || state.bankruptTo !== null) count++
    if (state.isBankrupt !== null) count++
    if (state.inLiquidation !== null) count++
    if (state.inForcedLiquidation !== null) count++
    if (state.hasAccounting !== null) count++
    return count
  },
}))
