import React, { memo, useCallback } from 'react'
import { Star } from 'lucide-react'
import { useFavoritesStore } from '../store/favoritesStore'

/** Props for FavoriteButton */
interface FavoriteButtonProps {
    orgnr: string
    navn: string
    organisasjonsform?: string
    /** Compact mode for cards/tables */
    compact?: boolean
}

/**
 * Button to toggle a company as favorite.
 * Shows filled star when favorited, outline when not.
 */
export const FavoriteButton = memo(function FavoriteButton({
    orgnr,
    navn,
    organisasjonsform,
    compact = false,
}: FavoriteButtonProps) {
    const isFavorite = useFavoritesStore((s) => s.isFavorite(orgnr))
    const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite)

    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation() // Prevent card/row click
        toggleFavorite({ orgnr, navn, organisasjonsform })
    }, [orgnr, navn, organisasjonsform, toggleFavorite])

    if (compact) {
        return (
            <button
                type="button"
                onClick={handleClick}
                aria-pressed={isFavorite}
                className={`rounded p-1 transition-colors ${isFavorite
                    ? 'text-yellow-500 hover:text-yellow-600 dark:text-yellow-300 dark:hover:text-yellow-200'
                    : 'text-gray-300 hover:text-yellow-400 dark:text-slate-600 dark:hover:text-yellow-300'
                    }`}
                title={isFavorite ? 'Fjern fra favoritter' : 'Legg til favoritter'}
                aria-label={isFavorite ? 'Fjern fra favoritter' : 'Legg til favoritter'}
            >
                <Star
                    className="h-4 w-4"
                    aria-hidden="true"
                    fill={isFavorite ? 'currentColor' : 'none'}
                />
            </button>
        )
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-pressed={isFavorite}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${isFavorite
                    ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-500/15 dark:text-yellow-200 dark:hover:bg-yellow-500/20'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
            title={isFavorite ? 'Fjern fra favoritter' : 'Legg til favoritter'}
        >
            <Star
                className="h-4 w-4"
                aria-hidden="true"
                fill={isFavorite ? 'currentColor' : 'none'}
            />
            <span>{isFavorite ? 'Favoritt' : 'Legg til'}</span>
        </button>
    )
})
