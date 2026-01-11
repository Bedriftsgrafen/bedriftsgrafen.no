import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface RecentCompany {
  orgnr: string
  navn: string
  organisasjonsform: string
  timestamp: number
}

interface RecentSearch {
  query: string
  timestamp: number
  resultCount?: number
}

// Available columns for the company table
export type CompanyColumn =
  | 'navn'
  | 'orgnr'
  | 'organisasjonsform'
  | 'naeringskode'
  | 'antall_ansatte'
  | 'stiftelsesdato'
  | 'kommune'
  | 'revenue'
  | 'profit'
  | 'operating_margin'

// Column configuration with labels
export const COLUMN_CONFIG: Record<CompanyColumn, { label: string; sortable: boolean; default: boolean }> = {
  navn: { label: 'Navn', sortable: true, default: true },
  orgnr: { label: 'Org.nr', sortable: true, default: true },
  organisasjonsform: { label: 'Type', sortable: true, default: true },
  naeringskode: { label: 'Næring', sortable: true, default: true },
  antall_ansatte: { label: 'Ansatte', sortable: true, default: true },
  stiftelsesdato: { label: 'Stiftet', sortable: true, default: false },
  kommune: { label: 'Kommune', sortable: true, default: false },
  revenue: { label: 'Omsetning', sortable: true, default: true },
  profit: { label: 'Resultat', sortable: true, default: true },
  operating_margin: { label: 'Driftsmargin', sortable: true, default: false },
}

// Default visible columns
const DEFAULT_VISIBLE_COLUMNS: CompanyColumn[] = Object.entries(COLUMN_CONFIG)
  .filter(([, config]) => config.default)
  .map(([key]) => key as CompanyColumn)

interface UiState {
  // Year selection (for company page)
  selectedYear: number | null

  // Pagination
  currentPage: number
  itemsPerPage: number

  // View mode
  viewMode: 'list' | 'grid'

  // Visible columns
  visibleColumns: CompanyColumn[]

  // Recent companies
  recentCompanies: RecentCompany[]

  // Recent searches
  recentSearches: RecentSearch[]

  // Actions
  setSelectedYear: (year: number | null) => void
  setPage: (page: number) => void
  setItemsPerPage: (items: number) => void
  setViewMode: (mode: 'list' | 'grid') => void
  toggleColumn: (column: CompanyColumn) => void
  setVisibleColumns: (columns: CompanyColumn[]) => void
  reorderColumns: (sourceIndex: number, destinationIndex: number) => void
  resetColumns: () => void
  addRecentCompany: (company: { orgnr: string; navn: string; organisasjonsform: string }) => void
  clearRecentCompanies: () => void
  addRecentSearch: (query: string, resultCount?: number) => void
  clearRecentSearches: () => void
  reset: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      // Initial state
      selectedYear: null,
      currentPage: 1,
      itemsPerPage: 20,
      viewMode: 'list',
      visibleColumns: DEFAULT_VISIBLE_COLUMNS,
      recentCompanies: [],
      recentSearches: [],

      // Actions
      setSelectedYear: (year) => set({ selectedYear: year }),
      setPage: (page) => set({ currentPage: page }),
      setItemsPerPage: (items) => set({ itemsPerPage: items, currentPage: 1 }),
      setViewMode: (mode) => set({ viewMode: mode }),
      toggleColumn: (column) => set((state) => {
        const isVisible = state.visibleColumns.includes(column)
        if (isVisible) {
          // Don't allow removing all columns - keep at least name
          if (state.visibleColumns.length <= 1) return state
          return { visibleColumns: state.visibleColumns.filter(c => c !== column) }
        } else {
          return { visibleColumns: [...state.visibleColumns, column] }
        }
      }),
      setVisibleColumns: (columns) => set({ visibleColumns: columns }),
      reorderColumns: (sourceIndex, destinationIndex) => set((state) => {
        // Bounds check to prevent invalid operations
        const len = state.visibleColumns.length
        if (sourceIndex < 0 || sourceIndex >= len || destinationIndex < 0 || destinationIndex >= len) {
          return state
        }
        const newColumns = [...state.visibleColumns]
        const [removed] = newColumns.splice(sourceIndex, 1)
        newColumns.splice(destinationIndex, 0, removed)
        return { visibleColumns: newColumns }
      }),
      resetColumns: () => set({ visibleColumns: DEFAULT_VISIBLE_COLUMNS }),
      addRecentCompany: (company) => set((state) => {
        // Remove if already exists
        const filtered = state.recentCompanies.filter(c => c.orgnr !== company.orgnr)
        // Add to front with timestamp
        const updated = [{ ...company, timestamp: Date.now() }, ...filtered]
        // Keep only last 6
        return { recentCompanies: updated.slice(0, 6) }
      }),
      clearRecentCompanies: () => set({ recentCompanies: [] }),
      addRecentSearch: (query, resultCount) => set((state) => {
        // Don't add empty searches
        if (!query.trim()) return state
        // Remove if already exists (case-insensitive)
        const filtered = state.recentSearches.filter(
          s => s.query.toLowerCase() !== query.toLowerCase()
        )
        // Add to front with timestamp
        const updated = [{ query: query.trim(), timestamp: Date.now(), resultCount }, ...filtered]
        // Keep only last 10
        return { recentSearches: updated.slice(0, 10) }
      }),
      clearRecentSearches: () => set({ recentSearches: [] }),
      reset: () => set({
        selectedYear: null,
        currentPage: 1,
      }),
    }),
    {
      name: 'bedriftsgrafen-ui-storage',
      partialize: (state) => ({
        recentCompanies: state.recentCompanies,
        recentSearches: state.recentSearches,
        visibleColumns: state.visibleColumns,
        viewMode: state.viewMode,
        itemsPerPage: state.itemsPerPage,
      }),
    }
  )
)

