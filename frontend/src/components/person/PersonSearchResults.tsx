import { useCallback } from 'react'
import { User, ArrowUpDown, List, LayoutGrid } from 'lucide-react'
import { Pagination } from '../common'
import { usePersonSearchResultsQuery } from '../../hooks/queries/usePersonSearchResultsQuery'
import { useSlowLoadingToast } from '../../hooks/useSlowLoadingToast'
import { formatNumber } from '../../utils/formatters'
import { PersonResultCard } from './PersonResultCard'
import { PersonResultRow } from './PersonResultRow'
import type { PersonSortField, PersonSortOrder, PersonViewMode } from '../../types/person'
import { PERSON_ITEMS_PER_PAGE } from '../../types/person'

type SortField = PersonSortField
type SortOrder = PersonSortOrder
type ViewMode = PersonViewMode

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
    const offset = (currentPage - 1) * PERSON_ITEMS_PER_PAGE

    const { data, isLoading, isError } = usePersonSearchResultsQuery(
        query,
        offset,
        PERSON_ITEMS_PER_PAGE,
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
                <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                    <User className="h-5 w-5 text-blue-600 dark:text-blue-300" aria-hidden="true" />
                    Resultater
                </h2>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 dark:text-slate-400" aria-live="polite" aria-busy={isLoading}>
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent dark:border-blue-300 dark:border-t-transparent" aria-hidden="true" />
                                Søker...
                            </span>
                        ) : (
                            `${formatNumber(totalCount)} ${totalCount === 1 ? 'person' : 'personer'} funnet`
                        )}
                    </span>

                    {/* Sort dropdown */}
                    <div className="flex items-center gap-1.5" role="group" aria-label="Sorter resultater">
                        <ArrowUpDown className="h-4 w-4 text-gray-400 dark:text-slate-500" aria-hidden="true" />
                        <select
                            value={sortBy}
                            onChange={(e) => onSortChange(e.target.value as SortField)}
                            className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:focus:ring-blue-300"
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
                    <div className="flex items-center overflow-hidden rounded-lg border border-gray-300 dark:border-slate-700" role="group" aria-label="Velg visning">
                        <button
                            type="button"
                            onClick={() => onViewModeChange('list')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors ${
                                viewMode === 'list'
                                    ? 'bg-blue-900 text-white dark:bg-blue-500 dark:text-slate-950'
                                    : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
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
                                    ? 'bg-blue-900 text-white dark:bg-blue-500 dark:text-slate-950'
                                    : 'bg-white text-gray-600 hover:bg-gray-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
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
                        <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800" />
                    ))}
                </div>
            )}

            {/* Error state */}
            {isError && !isLoading && (
                <div className="rounded-xl border border-red-100 bg-red-50 py-12 text-center dark:border-red-400/20 dark:bg-red-500/10">
                    <p className="font-medium text-red-600 dark:text-red-200">Kunne ikke utføre søket. Prøv igjen.</p>
                </div>
            )}

            {/* Empty state */}
            {!isLoading && !isError && results.length === 0 && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 py-12 text-center dark:border-slate-800 dark:bg-slate-900">
                    <User className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-slate-600" aria-hidden="true" />
                    <p className="font-medium text-gray-500 dark:text-slate-300">
                        Ingen personer funnet for &ldquo;{query}&rdquo;
                    </p>
                    <p className="mt-2 text-sm text-gray-400 dark:text-slate-500">
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
                <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50 dark:border-slate-800 dark:bg-slate-950">
                                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Navn</th>
                                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400 sm:table-cell">Fødselsår</th>
                                <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400">Aktive</th>
                                <th className="hidden px-4 py-3 text-center text-xs font-semibold uppercase text-gray-500 dark:text-slate-400 md:table-cell">Totalt</th>
                                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400 lg:table-cell">Topp rolle</th>
                                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500 dark:text-slate-400 lg:table-cell">Virksomhet</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
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
                        itemsPerPage={PERSON_ITEMS_PER_PAGE}
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
