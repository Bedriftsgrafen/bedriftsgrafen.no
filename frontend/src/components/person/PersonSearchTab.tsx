import { memo, useCallback } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { AlertTriangle } from 'lucide-react'
import { PersonSearchBar } from '../PersonSearchBar'
import { PersonSearchResults } from './PersonSearchResults'
import type { PersonSortField, PersonViewMode } from '../../types/person'
import { PERSON_ITEMS_PER_PAGE } from '../../types/person'
import { usePersonSearchResultsQuery } from '../../hooks/queries/usePersonSearchResultsQuery'

export const PersonSearchTab = memo(function PersonSearchTab() {
    const navigate = useNavigate({ from: '/person/' })
    const { q, sort, order, view, page } = useSearch({ from: '/person/' })

    const sortBy = sort ?? 'role_count'
    const sortOrder = order ?? 'desc'
    const viewMode = view ?? 'cards'
    const currentPage = page ?? 1

    const offset = (currentPage - 1) * PERSON_ITEMS_PER_PAGE
    const { isLoading } = usePersonSearchResultsQuery(
        q && q.length >= 3 ? q : '',
        offset,
        PERSON_ITEMS_PER_PAGE,
        sort ?? 'role_count',
        order ?? 'desc',
    )

    const handleSearch = useCallback((query: string) => {
        const trimmed = query.trim()
        navigate({
            to: '/person',
            search: (prev) => ({ ...prev, tab: 'sok' as const, q: trimmed || undefined, page: 1 }),
        })
    }, [navigate])

    const handleSortChange = useCallback((field: PersonSortField) => {
        const newOrder: 'asc' | 'desc' = sortBy === field
            ? (sortOrder === 'desc' ? 'asc' : 'desc')
            : (field === 'name' ? 'asc' : 'desc')
        navigate({
            to: '/person',
            search: (prev) => ({ ...prev, sort: field, order: newOrder, page: 1 }),
        })
    }, [navigate, sortBy, sortOrder])

    const handleViewModeChange = useCallback((mode: PersonViewMode) => {
        navigate({
            to: '/person',
            search: (prev) => ({ ...prev, view: mode }),
        })
    }, [navigate])

    const handlePageChange = useCallback((newPage: number) => {
        navigate({
            to: '/person',
            search: (prev) => ({ ...prev, page: newPage }),
        })
    }, [navigate])

    return (
        <div className="space-y-6">
            <div className="max-w-2xl">
                <PersonSearchBar
                    initialValue={q || ''}
                    onSearch={handleSearch}
                    isLoading={isLoading}
                />
            </div>

            {q && q.length >= 3 ? (
                <>
                    <PersonSearchResults
                        query={q}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        viewMode={viewMode}
                        currentPage={currentPage}
                        onPageChange={handlePageChange}
                        onSortChange={handleSortChange}
                        onViewModeChange={handleViewModeChange}
                    />

                    <div className="mb-4 p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
                        <p className="text-sm text-amber-800 leading-relaxed">
                            <strong>Viktig informasjon:</strong> I tråd med Enhetsregisterloven § 22 viser vi kun roller knyttet til næringsvirksomhet.
                            Roller i frivillige organisasjoner, borettslag og andre ikke-næringsdrivende enheter er utelatt fra denne oversikten for å ivareta personvern og regelverk.
                        </p>
                    </div>
                </>
            ) : (
                <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-gray-500 font-medium text-lg">Skriv inn et navn for å søke</p>
                    <p className="text-gray-400 text-sm mt-2">
                        Søk på hele eller deler av navnet (minimum 3 tegn).
                    </p>
                </div>
            )}
        </div>
    )
})
