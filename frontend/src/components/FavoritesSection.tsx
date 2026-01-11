import React, { memo, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Star, X, Building2 } from 'lucide-react'
import { useFavoritesStore } from '../store/favoritesStore'

/**
 * Section displaying user's favorite companies.
 * Shows on homepage when there are favorites.
 */
export const FavoritesSection = memo(function FavoritesSection() {
    const navigate = useNavigate()
    const favorites = useFavoritesStore((s) => s.favorites)
    const removeFavorite = useFavoritesStore((s) => s.removeFavorite)
    const clearFavorites = useFavoritesStore((s) => s.clearFavorites)

    const handleCompanyClick = useCallback((orgnr: string) => {
        navigate({ to: '/bedrift/$orgnr', params: { orgnr } })
    }, [navigate])

    const handleRemove = useCallback((e: React.MouseEvent, orgnr: string) => {
        e.stopPropagation()
        removeFavorite(orgnr)
    }, [removeFavorite])

    // Don't render if no favorites
    if (favorites.length === 0) return null

    return (
        <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-yellow-500" fill="currentColor" />
                    <h2 className="text-lg font-semibold text-gray-900">
                        Dine favoritter
                    </h2>
                    <span className="text-sm text-gray-500">
                        ({favorites.length})
                    </span>
                </div>
                {favorites.length > 3 && (
                    <button
                        type="button"
                        onClick={clearFavorites}
                        className="text-sm text-gray-500 hover:text-red-600 transition-colors"
                    >
                        Fjern alle
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {favorites.slice(0, 8).map((company) => (
                    <div
                        key={company.orgnr}
                        onClick={() => handleCompanyClick(company.orgnr)}
                        className="group flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg hover:border-yellow-300 hover:shadow-sm transition-all cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && handleCompanyClick(company.orgnr)}
                    >
                        <div className="flex-shrink-0 p-2 bg-yellow-50 text-yellow-600 rounded-lg">
                            <Building2 className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate group-hover:text-yellow-700 transition-colors">
                                {company.navn}
                            </p>
                            <p className="text-xs text-gray-500">
                                {company.organisasjonsform || 'Bedrift'} • {company.orgnr}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={(e) => handleRemove(e, company.orgnr)}
                            className="flex-shrink-0 p-1 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            title="Fjern fra favoritter"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>

            {favorites.length > 8 && (
                <p className="mt-3 text-sm text-gray-500 text-center">
                    + {favorites.length - 8} flere favoritter
                </p>
            )}
        </section>
    )
})
