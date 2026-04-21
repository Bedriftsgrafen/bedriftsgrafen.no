import { useCallback } from 'react'
import { User, ArrowUpDown, List, LayoutGrid } from 'lucide-react'
import { Pagination } from '../common'
import { usePersonSearchResultsQuery } from '../../hooks/queries/usePersonSearchResultsQuery'
import { useSlowLoadingToast } from '../../hooks/useSlowLoadingToast'
import { formatNumber } from '../../utils/formatters'
import { PersonResultCard } from './PersonResultCard'
import { PersonResultRow } from './PersonResultRow'

const ITEMS_PER_PAGE = 20

type SortField = 'role_count' | 'active_roles' | 'name'
type SortOrder = 'asc' | 'desc'
type ViewMode = 'cards' | 'list'

const SORT_OPTIONS: { value: SortField; label: string }[] = [
    { value: 'role_count', label: 'Antall roller' },
    { value: 'active_roles', label: 'Aktive roller' },
    { value: 'name', label: 'Navn' },
]

interface PersonSearchResultsProps {
    query: string
    sortBy: SortField
    sortOrder: SortOrder
    viewMode: ViewMode
    currentPage: number
    onPageChange: (page: number) => void
    onSortChange: (field: SortField) => void
    onViewModeChange: (mode: ViewMode) => void
}

export function PersonSearchResults({
    query,
    sortBy,
    sortOrder,
    viewMode,
    currentPage,
    onPageChange,
    onSortChange,
    onViewModeChange,
}: PersonSearchResultsProps) {
    const offset = (currentPage - 1) * ITEMS_PER_PAGE

    const { data, isLoading, isError } = usePersonSearchResultsQuery(
        query,
        offset,
        ITEMS_PER_PAGE,
        sortBy,
        sortOrder,
    )

    useSlowLoadingToast(isLoading, 'Søker etter personer...')

    const results = data?.results ?? []
    const totalCount = data?.total_count ?? 0

    const handlePreviousPage = useCallback(() => {
        onPageChange(Math.max(1, currentPage - 1))
    }, [currentPage, onPageChange])

    const handleNextPage = useCallback(() => {
        onPageChange(currentPage + 1)
    }, [currentPage, onPageChange])

    return (
        <div className="mb-8">
            {/* Toolbar: count, sort, view mode */}
            <div className="px-1 py-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-semibold text-lg text-slate-900 flex items-center gap-2">
                    <User className="h-5 w-5 text-blue-600" />
                    Resultater
                </h2>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600" aria-live="polite" aria-busy={isLoading}>
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                                Søker...
                            </span>
                        ) : (
                            `${formatNumber(totalCount)} ${totalCount === 1 ? 'person' : 'personer'} funnet`
                        )}
                    </span>

                    {/* Sort dropdown */}
                    <div className="flex items-center gap-1.5">
                        <ArrowUpDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        <select
                            value={sortBy}
                            onChange={(e) => onSortChange(e.target.value as SortField)}
                            className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            aria-label="Sortering"
                        >
                            {SORT_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label} {sortBy === opt.value ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* View mode toggle */}
                    <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                        <button
                            type="button"
                            onClick={() => onViewModeChange('list')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                                viewMode === 'list'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                            aria-pressed={viewMode === 'list'}
                            aria-label="Listevisning"
                            title="Listevisning"
                        >
                            <List className="h-4 w-4" aria-hidden="true" />
                            <span className="hidden sm:inline">Liste</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onViewModeChange('cards')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                                viewMode === 'cards'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-white text-gray-600 hover:bg-gray-50'
                            }`}
                            aria-pressed={viewMode === 'cards'}
                            aria-label="Kortvisning"
                            title="Kortvisning"
                        >
                            <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                            <span className="hidden sm:inline">Kort</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Loading skeleton */}
            {isLoading && (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
                    ))}
                </div>
            )}

            {/* Error state */}
            {isError && !isLoading && (
                <div className="text-center py-12 bg-red-50 rounded-xl border border-red-100">
                    <p className="text-red-600 font-medium">Kunne ikke utføre søket. Prøv igjen.</p>
                </div>
            )}

            {/* Empty state */}
            {!isLoading && !isError && results.length === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100">
                    <User className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">
                        Ingen personer funnet for &ldquo;{query}&rdquo;
                    </p>
                    <p className="text-gray-400 text-sm mt-2">
                        Prøv et annet søkeord, eller sjekk at du har stavet navnet riktig.
                    </p>
                </div>
            )}

            {/* Card view */}
            {!isLoading && !isError && results.length > 0 && viewMode === 'cards' && (
                <div className="grid gap-3">
                    {results.map((person, idx) => (
                        <PersonResultCard
                            key={`${person.name}-${person.birthdate}-${idx}`}
                            person={person}
                        />
                    ))}
                </div>
            )}

            {/* List view */}
            {!isLoading && !isError && results.length > 0 && viewMode === 'list' && (
                <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Navn</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Fødselsår</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Aktive</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Totalt</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Topp rolle</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Virksomhet</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {results.map((person, idx) => (
                                <PersonResultRow
                                    key={`${person.name}-${person.birthdate}-${idx}`}
                                    person={person}
                                />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            {!isError && results.length > 0 && (
                <div className="mt-6">
                    <Pagination
                        currentPage={currentPage}
                        totalCount={totalCount}
                        itemsPerPage={ITEMS_PER_PAGE}
                        currentItemsCount={results.length}
                        onPreviousPage={handlePreviousPage}
                        onNextPage={handleNextPage}
                        onPageChange={onPageChange}
                        itemLabel="personer"
                    />
                </div>
            )}
        </div>
    )
}
