/**
 * Store for company comparison feature.
 * Allows selecting up to 3 companies for side-by-side comparison.
 */
import { create } from 'zustand'
import { toast } from './toastStore'

/** Maximum companies that can be compared */
const MAX_COMPARISON = 3

/** Company info for comparison display */
export interface ComparisonCompany {
    orgnr: string
    navn: string
}

/** Comparison store state */
interface ComparisonState {
    /** Selected companies for comparison */
    companies: ComparisonCompany[]
    /** Whether comparison modal is open */
    isModalOpen: boolean

    /** Add a company to comparison (max 3) */
    addCompany: (company: ComparisonCompany) => void
    /** Remove a company from comparison */
    removeCompany: (orgnr: string) => void
    /** Check if company is in comparison */
    isSelected: (orgnr: string) => boolean
    /** Clear all companies */
    clear: () => void
    /** Open comparison modal */
    openModal: () => void
    /** Close comparison modal */
    closeModal: () => void
}

export const useComparisonStore = create<ComparisonState>((set, get) => ({
    companies: [],
    isModalOpen: false,

    addCompany: (company) => {
        const { companies } = get()
        // Already selected
        if (companies.some(c => c.orgnr === company.orgnr)) return

        // Max reached
        if (companies.length >= MAX_COMPARISON) {
            toast.warning(`Du kan maksimalt sammenligne ${MAX_COMPARISON} bedrifter`)
            return
        }

        set({ companies: [...companies, company] })
        toast.success('Lagt til i sammenligning')
    },

    removeCompany: (orgnr) => {
        set((state) => ({
            companies: state.companies.filter(c => c.orgnr !== orgnr)
        }))
    },

    isSelected: (orgnr) => {
        return get().companies.some(c => c.orgnr === orgnr)
    },

    clear: () => set({ companies: [] }),

    openModal: () => set({ isModalOpen: true }),

    closeModal: () => set({ isModalOpen: false }),
}))

/** Hook for comparison count */
export const useComparisonCount = () =>
    useComparisonStore((s) => s.companies.length)
