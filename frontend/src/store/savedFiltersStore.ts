import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Filter configuration that can be saved
export interface SavedFilter {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  filters: {
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
    foundedFrom: string | null  // ISO date string for serialization
    foundedTo: string | null
    bankruptFrom: string | null
    bankruptTo: string | null
    isBankrupt: boolean | null
    inLiquidation: boolean | null
    inForcedLiquidation: boolean | null
    hasAccounting: boolean | null
  }
}

interface SavedFiltersState {
  savedFilters: SavedFilter[]

  // Actions
  saveFilter: (name: string, filters: SavedFilter['filters']) => string
  updateFilter: (id: string, name: string, filters: SavedFilter['filters']) => void
  deleteFilter: (id: string) => void
  renameFilter: (id: string, name: string) => void
  getFilter: (id: string) => SavedFilter | undefined
}

export const useSavedFiltersStore = create<SavedFiltersState>()(
  persist(
    (set, get) => ({
      savedFilters: [],

      saveFilter: (name, filters) => {
        const id = Math.random().toString(36).substring(2, 9)
        const now = Date.now()
        set((state) => ({
          savedFilters: [
            { id, name, createdAt: now, updatedAt: now, filters },
            ...state.savedFilters,
          ].slice(0, 20), // Max 20 saved filters
        }))
        return id
      },

      updateFilter: (id, name, filters) => {
        set((state) => ({
          savedFilters: state.savedFilters.map((f) =>
            f.id === id ? { ...f, name, filters, updatedAt: Date.now() } : f
          ),
        }))
      },

      deleteFilter: (id) => {
        set((state) => ({
          savedFilters: state.savedFilters.filter((f) => f.id !== id),
        }))
      },

      renameFilter: (id, name) => {
        set((state) => ({
          savedFilters: state.savedFilters.map((f) =>
            f.id === id ? { ...f, name, updatedAt: Date.now() } : f
          ),
        }))
      },

      getFilter: (id) => {
        return get().savedFilters.find((f) => f.id === id)
      },
    }),
    {
      name: 'bedriftsgrafen-saved-filters',
    }
  )
)

// Helper to count active filters in a saved filter
export function countActiveFilters(filters: SavedFilter['filters']): number {
  let count = 0
  if (filters.searchQuery) count++
  if (filters.organizationForms.length > 0) count++
  if (filters.naeringskode) count++
  if (filters.revenueMin !== null || filters.revenueMax !== null) count++
  if (filters.profitMin !== null || filters.profitMax !== null) count++
  if (filters.equityMin !== null || filters.equityMax !== null) count++
  if (filters.operatingProfitMin !== null || filters.operatingProfitMax !== null) count++
  if (filters.liquidityRatioMin !== null || filters.liquidityRatioMax !== null) count++
  if (filters.equityRatioMin !== null || filters.equityRatioMax !== null) count++
  if (filters.employeeMin !== null || filters.employeeMax !== null) count++
  if (filters.municipality) count++
  if (filters.foundedFrom !== null || filters.foundedTo !== null) count++
  if (filters.bankruptFrom !== null || filters.bankruptTo !== null) count++
  if (filters.isBankrupt !== null) count++
  if (filters.inLiquidation !== null) count++
  if (filters.inForcedLiquidation !== null) count++
  if (filters.hasAccounting !== null) count++
  return count
}
