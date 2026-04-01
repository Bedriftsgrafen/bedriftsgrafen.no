/* eslint-disable react-refresh/only-export-components */
import { createLazyFileRoute, Link } from '@tanstack/react-router'
import { useState, useCallback, useEffect } from 'react'
import { User, Building2, AlertTriangle, Briefcase, ArrowRight, List, LayoutGrid, ArrowUpDown } from 'lucide-react'
import { SEOHead, Breadcrumbs } from '../components/layout'
import { Pagination, SearchTypeNav } from '../components/common'
import { PersonSearchBar } from '../components/PersonSearchBar'
import { usePersonSearchResultsQuery } from '../hooks/queries/usePersonSearchResultsQuery'
import { useSlowLoadingToast } from '../hooks/useSlowLoadingToast'
import { formatNumber } from '../utils/formatters'
import type { PersonSearchResultDetailed } from '../types/person'

export const Route = createLazyFileRoute('/personer')({
    component: PersonerPage,
})

const ITEMS_PER_PAGE = 20

type SortField = 'role_count' | 'active_roles' | 'name'
type SortOrder = 'asc' | 'desc'
type ViewMode = 'cards' | 'list'

const SORT_OPTIONS: { value: SortField; label: string }[] = [
    { value: 'role_count', label: 'Antall roller' },
    { value: 'active_roles', label: 'Aktive roller' },
    { value: 'name', label: 'Navn' },
]

function PersonResultCard({ person }: { person: PersonSearchResultDetailed }) {
    const birthYear = person.birthdate ? person.birthdate.slice(0, 4) : null
    const resignedCount = person.role_count - person.active_role_count

    return (
        <Link
            to="/person/$name/$birthdate"
            params={{
                name: person.name,
                birthdate: birthYear || 'unknown',
            }}
            className="group block p-5 rounded-xl border border-gray-100 bg-white hover:border-blue-200 hover:shadow-md transition-all"
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                    <div className="p-3 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                        <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                            {person.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 mt-1">
                            {birthYear && (
                                <span>Fødselsår: {birthYear}</span>
                            )}
                            <span className="flex items-center gap-1">
                                <Briefcase className="h-3.5 w-3.5" />
                                {person.active_role_count} aktiv{person.active_role_count !== 1 ? 'e' : ''} rolle{person.active_role_count !== 1 ? 'r' : ''}
                                {resignedCount > 0 && (
                                    <span className="text-gray-400">({resignedCount} fratrådt)</span>
                                )}
                            </span>
                        </div>

                        {/* Top roles */}
                        {person.top_roles.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {person.top_roles.map((role) => (
                                    <span
                                        key={role}
                                        className="text-xs font-medium text-blue-600/80 bg-blue-50 px-2 py-0.5 rounded"
                                    >
                                        {role}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Notable companies */}
                        {person.notable_companies.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                                <Building2 className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">
                                    {person.notable_companies.join(', ')}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="shrink-0 p-2 text-gray-400 group-hover:text-blue-600 transition-colors">
                    <ArrowRight className="h-5 w-5" />
                </div>
            </div>
        </Link>
    )
}

function PersonResultRow({ person }: { person: PersonSearchResultDetailed }) {
    const birthYear = person.birthdate ? person.birthdate.slice(0, 4) : null
    const topRole = person.top_roles[0]?.replace(/\s*\(\d+\)$/, '') ?? '—'
    const topCompany = person.notable_companies[0] ?? '—'

    return (
        <Link
            to="/person/$name/$birthdate"
            params={{
                name: person.name,
                birthdate: birthYear || 'unknown',
            }}
            className="group table-row hover:bg-blue-50/50 transition-colors"
        >
            <td className="px-4 py-3 text-sm font-medium text-gray-900 group-hover:text-blue-700">
                {person.name}
            </td>
            <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                {birthYear ?? '—'}
            </td>
            <td className="px-4 py-3 text-sm text-gray-600 text-center">
                {person.active_role_count}
            </td>
            <td className="px-4 py-3 text-sm text-gray-600 text-center hidden md:table-cell">
                {person.role_count}
            </td>
            <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">
                {topRole}
            </td>
            <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell truncate max-w-48">
                {topCompany}
            </td>
        </Link>
    )
}

function PersonerPage() {
    const navigate = Route.useNavigate()
    const { q, sort, order, view } = Route.useSearch()
    const [currentPage, setCurrentPage] = useState(1)

    const sortBy: SortField = sort ?? 'role_count'
    const sortOrder: SortOrder = order ?? 'desc'
    const viewMode: ViewMode = view ?? 'cards'

    const offset = (currentPage - 1) * ITEMS_PER_PAGE

    const {
        data,
        isLoading,
        isError,
    } = usePersonSearchResultsQuery(q || '', offset, ITEMS_PER_PAGE, sortBy, sortOrder)

    useSlowLoadingToast(isLoading, 'Søker etter personer...')

    // Reset page when query changes
    useEffect(() => {
        // eslint-disable-next-line @eslint-react/set-state-in-effect
        setCurrentPage(1)
    }, [q])

    const results = data?.results ?? []
    const totalCount = data?.total_count ?? 0

    const handleSearch = useCallback((query: string) => {
        setCurrentPage(1)
        navigate({ to: '/personer', search: (prev) => ({ ...prev, q: query }) })
    }, [navigate])

    const handlePreviousPage = useCallback(() => {
        setCurrentPage((p) => Math.max(1, p - 1))
    }, [])

    const handleNextPage = useCallback(() => {
        setCurrentPage((p) => p + 1)
    }, [])

    const handleSortChange = useCallback((field: SortField) => {
        const newOrder: SortOrder = sortBy === field
            ? (sortOrder === 'desc' ? 'asc' : 'desc')
            : (field === 'name' ? 'asc' : 'desc')
        setCurrentPage(1)
        navigate({ to: '/personer', search: (prev) => ({ ...prev, sort: field, order: newOrder }) })
    }, [navigate, sortBy, sortOrder])

    const handleViewModeChange = useCallback((mode: ViewMode) => {
        navigate({ to: '/personer', search: (prev) => ({ ...prev, view: mode }) })
    }, [navigate])

    return (
        <>
            <SEOHead
                title={q ? `Personsøk: "${q}" | Bedriftsgrafen.no` : 'Personsøk | Bedriftsgrafen.no'}
                description="Søk etter personer med roller i norsk næringsvirksomhet. Finn styremedlemmer, daglige ledere og andre roller."
            />

            <Breadcrumbs
                items={[
                    { label: 'Hjem', to: '/' },
                    { label: 'Personsøk' },
                ]}
            />

            <SearchTypeNav active="personer" query={q} />

            {/* Page header */}
            <div className="mb-6">
                <div className="max-w-2xl">
                    <h1 className="text-3xl font-bold text-black mb-2">Personsøk</h1>
                    <p className="text-gray-700 text-lg mb-4">
                        Søk etter personer med roller i norsk næringsvirksomhet.
                    </p>
                </div>
                <div className="max-w-2xl">
                    <PersonSearchBar
                        initialValue={q || ''}
                        onSearch={handleSearch}
                        isLoading={isLoading}
                    />
                </div>
            </div>

            {/* Results */}
            {q && (
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
                                    onChange={(e) => handleSortChange(e.target.value as SortField)}
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
                                    onClick={() => handleViewModeChange('list')}
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
                                    onClick={() => handleViewModeChange('cards')}
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
                                Ingen personer funnet for &ldquo;{q}&rdquo;
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
                                onPageChange={setCurrentPage}
                                itemLabel="personer"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* No query state */}
            {!q && (
                <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-100">
                    <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500 font-medium text-lg">Skriv inn et navn for å søke</p>
                    <p className="text-gray-400 text-sm mt-2">
                        Søk på hele eller deler av navnet (minimum 3 tegn).
                    </p>
                </div>
            )}

            {/* Legal disclaimer */}
            <div className="mt-8 mb-4 p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm text-amber-800 leading-relaxed">
                    <strong>Viktig informasjon:</strong> I tråd med Enhetsregisterloven § 22 viser vi kun roller knyttet til næringsvirksomhet.
                    Roller i frivillige organisasjoner, borettslag og andre ikke-næringsdrivende enheter er utelatt fra denne oversikten for å ivareta personvern og regelverk.
                </p>
            </div>
        </>
    )
}
