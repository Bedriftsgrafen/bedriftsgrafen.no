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
                className={`p-1 rounded transition-colors ${isFavorite
                        ? 'text-yellow-500 hover:text-yellow-600'
                        : 'text-gray-300 hover:text-yellow-400'
                    }`}
                title={isFavorite ? 'Fjern fra favoritter' : 'Legg til favoritter'}
                aria-label={isFavorite ? 'Fjern fra favoritter' : 'Legg til favoritter'}
            >
                <Star
                    className="h-4 w-4"
                    fill={isFavorite ? 'currentColor' : 'none'}
                />
            </button>
        )
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg transition-colors ${isFavorite
                    ? 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            title={isFavorite ? 'Fjern fra favoritter' : 'Legg til favoritter'}
        >
            <Star
                className="h-4 w-4"
                fill={isFavorite ? 'currentColor' : 'none'}
            />
            <span>{isFavorite ? 'Favoritt' : 'Legg til'}</span>
        </button>
    )
})
