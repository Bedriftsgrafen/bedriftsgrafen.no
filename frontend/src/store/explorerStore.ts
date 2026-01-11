import { create } from 'zustand'

interface ExplorerState {
    // View options
    viewMode: 'list' | 'cards'
    groupBy: 'county' | 'industry' | null

    // Selection for bulk actions/export
    selectedForExport: string[]  // orgnr array

    // Modal states
    isNaceModalOpen: boolean
    isRegionModalOpen: boolean

    // Actions
    setViewMode: (mode: 'list' | 'cards') => void
    setGroupBy: (group: 'county' | 'industry' | null) => void
    toggleExportSelection: (orgnr: string) => void
    clearExportSelection: () => void
    selectAllForExport: (orgnrs: string[]) => void
    setNaceModalOpen: (open: boolean) => void
    setRegionModalOpen: (open: boolean) => void
}

export const useExplorerStore = create<ExplorerState>((set) => ({
    // Initial state
    viewMode: 'list',
    groupBy: null,
    selectedForExport: [],
    isNaceModalOpen: false,
    isRegionModalOpen: false,

    // Actions
    setViewMode: (mode) => set({ viewMode: mode }),
    setGroupBy: (group) => set({ groupBy: group }),

    toggleExportSelection: (orgnr) => set((state) => ({
        selectedForExport: state.selectedForExport.includes(orgnr)
            ? state.selectedForExport.filter((id) => id !== orgnr)
            : [...state.selectedForExport, orgnr]
    })),

    clearExportSelection: () => set({ selectedForExport: [] }),

    selectAllForExport: (orgnrs) => set({ selectedForExport: orgnrs }),

    setNaceModalOpen: (open) => set({ isNaceModalOpen: open }),
    setRegionModalOpen: (open) => set({ isRegionModalOpen: open }),
}))
