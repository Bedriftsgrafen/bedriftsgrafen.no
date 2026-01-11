/**
 * Store for favorite companies.
 * Persisted to localStorage for cross-session access.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { toast } from './toastStore'

/** Favorite company data */
export interface FavoriteCompany {
    orgnr: string
    navn: string
    organisasjonsform?: string
    addedAt: number
}

/** Maximum favorites allowed */
const MAX_FAVORITES = 50

/** Favorites store state */
interface FavoritesState {
    /** List of favorite companies */
    favorites: FavoriteCompany[]

    /** Add a company to favorites */
    addFavorite: (company: Omit<FavoriteCompany, 'addedAt'>) => void
    /** Remove a company from favorites */
    removeFavorite: (orgnr: string) => void
    /** Toggle favorite status */
    toggleFavorite: (company: Omit<FavoriteCompany, 'addedAt'>) => void
    /** Check if company is a favorite */
    isFavorite: (orgnr: string) => boolean
    /** Clear all favorites */
    clearFavorites: () => void
}

export const useFavoritesStore = create<FavoritesState>()(
    persist(
        (set, get) => ({
            favorites: [],

            addFavorite: (company) => {
                const { favorites, isFavorite } = get()
                if (isFavorite(company.orgnr)) return
                if (favorites.length >= MAX_FAVORITES) return

                set({
                    favorites: [
                        { ...company, addedAt: Date.now() },
                        ...favorites,
                    ]
                })
            },

            removeFavorite: (orgnr) => {
                set((state) => ({
                    favorites: state.favorites.filter(f => f.orgnr !== orgnr)
                }))
            },

            toggleFavorite: (company) => {
                const { isFavorite, addFavorite, removeFavorite } = get()
                if (isFavorite(company.orgnr)) {
                    removeFavorite(company.orgnr)
                    toast.info(`${company.navn} fjernet fra favoritter`)
                } else {
                    addFavorite(company)
                    toast.success(`${company.navn} lagt til i favoritter`)
                }
            },

            isFavorite: (orgnr) => {
                return get().favorites.some(f => f.orgnr === orgnr)
            },

            clearFavorites: () => set({ favorites: [] }),
        }),
        {
            name: 'bedriftsgrafen-favorites',
        }
    )
)

/** Hook for favorites count */
export const useFavoritesCount = () =>
    useFavoritesStore((s) => s.favorites.length)
