import { create } from 'zustand'

/**
 * Filter values - data only, no functions
 * Used for setAllFilters to ensure type safety
 */
interface FilterValues {
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
  county: string
  foundedFrom: Date | null
  foundedTo: Date | null
  bankruptFrom: Date | null
  bankruptTo: Date | null
  isBankrupt: boolean | null
  inLiquidation: boolean | null
  inForcedLiquidation: boolean | null
  yearFrom: number | null
  yearTo: number | null
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
  setNaceCodes: (codes: string[]) => void
  setNaeringskode: (code: string) => void
  setRevenueRange: (min: number | null, max: number | null) => void
  setProfitRange: (min: number | null, max: number | null) => void
  setEquityRange: (min: number | null, max: number | null) => void
  setOperatingProfitRange: (min: number | null, max: number | null) => void
  setLiquidityRatioRange: (min: number | null, max: number | null) => void
  setEquityRatioRange: (min: number | null, max: number | null) => void
  setEmployeeRange: (min: number | null, max: number | null) => void
  setMunicipality: (municipality: string) => void
  setCounty: (county: string) => void
  setFoundedRange: (from: Date | null, to: Date | null) => void
  setBankruptRange: (from: Date | null, to: Date | null) => void
  setStatus: (key: 'isBankrupt' | 'inLiquidation' | 'inForcedLiquidation', value: boolean | null) => void
  setYearRange: (from: number | null, to: number | null) => void
  setHasAccounting: (has: boolean | null) => void
  setSort: (by: string, order: 'asc' | 'desc') => void
  setAllFilters: (filters: Partial<FilterValues>) => void
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
  naceCodes: [],
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
  county: '',
  foundedFrom: null,
  foundedTo: null,
  bankruptFrom: null,
  bankruptTo: null,
  isBankrupt: null,
  inLiquidation: null,
  inForcedLiquidation: null,
  yearFrom: null,
  yearTo: null,
  hasAccounting: null,
  sortBy: 'navn',
  sortOrder: 'asc',
  filterVersion: 0,

  // Actions
  setSearchQuery: (query) => set({ searchQuery: query }),
  setOrganizationForms: (forms) => set({ organizationForms: forms }),
  setNaceCodes: (codes) => set({ naceCodes: codes }),
  setNaeringskode: (code) => set({ naeringskode: code }),
  setRevenueRange: (min, max) => set({ revenueMin: min, revenueMax: max }),
  setProfitRange: (min, max) => set({ profitMin: min, profitMax: max }),
  setEquityRange: (min, max) => set({ equityMin: min, equityMax: max }),
  setOperatingProfitRange: (min, max) => set({ operatingProfitMin: min, operatingProfitMax: max }),
  setLiquidityRatioRange: (min, max) => set({ liquidityRatioMin: min, liquidityRatioMax: max }),
  setEquityRatioRange: (min, max) => set({ equityRatioMin: min, equityRatioMax: max }),
  setEmployeeRange: (min, max) => set({ employeeMin: min, employeeMax: max }),
  setMunicipality: (m) => set({ municipality: m }),
  setCounty: (c) => set({ county: c }),
  setFoundedRange: (from, to) => set({ foundedFrom: from, foundedTo: to }),
  setBankruptRange: (from, to) => set({ bankruptFrom: from, bankruptTo: to }),
  setStatus: (key, value) => set({ [key]: value }),
  setYearRange: (from, to) => set({ yearFrom: from, yearTo: to }),
  setHasAccounting: (has) => set({ hasAccounting: has }),
  setSort: (by, order) => set({ sortBy: by, sortOrder: order }),
  setAllFilters: (filters) => set((state) => ({ ...filters, filterVersion: state.filterVersion + 1 })),
  incrementFilterVersion: () => set((state) => ({ filterVersion: state.filterVersion + 1 })),
  clearFilters: () => set((state) => ({
    searchQuery: '',
    organizationForms: [],
    naceCodes: [],
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
    county: '',
    foundedFrom: null,
    foundedTo: null,
    bankruptFrom: null,
    bankruptTo: null,
    isBankrupt: null,
    inLiquidation: null,
    inForcedLiquidation: null,
    yearFrom: null,
    yearTo: null,
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
    if (state.naceCodes.length > 0) count++
    if (state.naeringskode) count++
    if (state.revenueMin !== null || state.revenueMax !== null) count++
    if (state.profitMin !== null || state.profitMax !== null) count++
    if (state.equityMin !== null || state.equityMax !== null) count++
    if (state.operatingProfitMin !== null || state.operatingProfitMax !== null) count++
    if (state.liquidityRatioMin !== null || state.liquidityRatioMax !== null) count++
    if (state.equityRatioMin !== null || state.equityRatioMax !== null) count++
    if (state.employeeMin !== null || state.employeeMax !== null) count++
    if (state.municipality) count++
    if (state.county) count++
    if (state.foundedFrom !== null || state.foundedTo !== null) count++
    if (state.bankruptFrom !== null || state.bankruptTo !== null) count++
    if (state.isBankrupt !== null) count++
    if (state.inLiquidation !== null) count++
    if (state.inForcedLiquidation !== null) count++
    if (state.yearFrom !== null || state.yearTo !== null) count++
    if (state.hasAccounting !== null) count++
    return count
  },
}))
