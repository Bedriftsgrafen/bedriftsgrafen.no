/**
 * Bankruptcy list component - displays companies that went bankrupt.
 * Features: sortable columns, employee count, bransje/kommune filters
 */

import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, Search, Filter, X } from 'lucide-react'
import { SortableHeader } from '../common/SortableHeader'
import { formatNumber } from '../../utils/formatters'
import { formatNace } from '../../utils/nace'
import { RegionSelect } from '../common/RegionSelect'
import { LoadingState } from '../common/LoadingState'
import { ErrorState } from '../common/ErrorState'
import { useTableState } from '../../hooks/useTableState'
import { useCompaniesQuery } from '../../hooks/queries/useCompaniesQuery'
import { useCompanyStatsQuery } from '../../hooks/queries/useCompanyStatsQuery'


interface BankruptcyListProps {
    onSelectCompany: (orgnr: string) => void
    bankruptFrom: string
    initialNace?: string
    initialCounty?: string
    initialCountyCode?: string
    initialMunicipality?: string
    initialMunicipalityCode?: string
}

type SortField = 'navn' | 'konkursdato' | 'antall_ansatte' | 'naeringskode'


export function BankruptcyList({
    onSelectCompany,
    bankruptFrom,
    initialNace = '',
    initialCounty = '',
    initialCountyCode = '',
    initialMunicipality = '',
    initialMunicipalityCode = ''
}: BankruptcyListProps) {
    const {
        page,
        searchQuery, setSearchQuery,
        sortBy, sortOrder, handleSort,
        filters, setFilter, resetFilters,
        showFilters, setShowFilters,
        itemsPerPage,
        activeFilterCount, hasActiveFilters,
        nextPage, prevPage
    } = useTableState<{
        nace: string,
        county: string,
        county_code: string,
        municipality: string,
        municipality_code: string
    }, SortField>({
        initialSortBy: 'konkursdato',
        initialFilters: {
            nace: initialNace,
            county: initialCounty,
            county_code: initialCountyCode,
            municipality: initialMunicipality,
            municipality_code: initialMunicipalityCode
        }
    })


    // Fetch bankruptcies with sorting and filters
    const { data: companies, isLoading, error } = useCompaniesQuery({
        skip: (page - 1) * itemsPerPage,
        limit: itemsPerPage,
        is_bankrupt: true,
        bankrupt_from: bankruptFrom,
        sort_by: sortBy,
        sort_order: sortOrder,
        naeringskode: filters.nace || undefined,
        county: filters.county || undefined,
        municipality: filters.municipality || undefined,
        municipality_code: filters.municipality_code || undefined
    })

    // Fetch total count with filters via stats endpoint (optimized)
    const { data: stats } = useCompanyStatsQuery({
        is_bankrupt: true,
        bankrupt_from: bankruptFrom,
        naeringskode: filters.nace || undefined,
        county: filters.county || undefined,
        municipality: filters.municipality || undefined,
        municipality_code: filters.municipality_code || undefined
    })

    const totalCount = stats?.total_count

    const totalPages = totalCount ? Math.ceil(totalCount / itemsPerPage) : 1
    const filterPanelId = 'bankruptcy-filters'


    // Render sort indicator inline

    // Filter data locally by search query
    const filteredData = useMemo(() => {
        if (!companies) return []
        if (!searchQuery.trim()) return companies
        const query = searchQuery.toLowerCase()
        return companies.filter(
            (c) => (c.navn?.toLowerCase().includes(query) || c.orgnr.includes(query))
        )
    }, [companies, searchQuery])



    if (isLoading) {
        return <LoadingState message="Laster konkursliste..." />
    }

    if (error) {
        return <ErrorState message="Kunne ikke laste konkursliste" />
    }

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {/* Header with search and filters */}
            <div className="flex flex-col justify-between gap-3 border-b border-gray-200 px-4 py-3 dark:border-slate-800 sm:flex-row sm:items-center">
                <span className="text-sm text-gray-600 dark:text-slate-300">
                    Viser {filteredData.length} av {formatNumber(totalCount ?? 0)} konkurser
                </span>
                <div className="flex items-center gap-3">
                    {/* Filter button */}
                    <button
                        type="button"
                        onClick={() => setShowFilters(!showFilters)}
                        aria-expanded={showFilters}
                        aria-controls={filterPanelId}
                        className={`flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition-colors ${hasActiveFilters
                            ? 'border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-400/40 dark:bg-blue-500/15 dark:text-blue-200'
                            : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-white/5'
                            }`}
                    >
                        <Filter className="w-4 h-4" aria-hidden="true" />
                        Filtrer
                        {activeFilterCount > 0 && (
                            <span className="rounded-full bg-blue-900 px-1.5 text-xs text-white dark:bg-blue-500 dark:text-slate-950">{activeFilterCount}</span>
                        )}
                    </button>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500" aria-hidden="true" />
                        <input
                            type="text"
                            placeholder="Søk i listen..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-48 rounded-lg border border-gray-300 py-1.5 pl-9 pr-4 text-sm text-slate-900 focus:border-red-500 focus:ring-2 focus:ring-red-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-red-400 dark:focus:ring-red-400"
                            aria-label="Søk i konkurser"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={prevPage}
                            disabled={page === 1}
                            className="rounded p-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/10"
                            aria-label="Forrige side"
                        >
                            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                        </button>
                        <span className="text-sm text-gray-600 dark:text-slate-300">
                            Side {page} av {totalPages}
                        </span>
                        <button
                            onClick={() => nextPage(totalPages)}
                            disabled={page >= totalPages}
                            className="rounded p-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-300 dark:hover:bg-white/10"
                            aria-label="Neste side"
                        >
                            <ChevronRight className="h-5 w-5" aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter panel */}
            {showFilters && (
                <div id={filterPanelId} className="flex flex-wrap items-center gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600 dark:text-slate-300">Bransje:</label>
                        <input
                            type="text"
                            placeholder="F.eks. 68"
                            value={filters.nace}
                            onChange={(e) => setFilter('nace', e.target.value)}
                            className="w-24 rounded border border-gray-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:ring-red-400"
                            aria-label="Filtrer konkurser etter bransjekode"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600 dark:text-slate-300">Fylke:</label>
                        <RegionSelect
                            type="county"
                            value={filters.county}
                            onChange={(value) => {
                                setFilter('county', value);
                                setFilter('municipality', '');
                            }}
                            placeholder="Velg fylke..."
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600 dark:text-slate-300">Kommune:</label>
                        <RegionSelect
                            type="municipality"
                            value={filters.municipality}
                            onChange={(value) => {
                                setFilter('municipality', value);
                                setFilter('county', '');
                            }}
                            placeholder="Velg kommune..."
                        />
                    </div>
                    {hasActiveFilters && (
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="flex items-center gap-1 text-sm text-red-600 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200"
                        >
                            <X className="w-4 h-4" aria-hidden="true" />
                            Nullstill
                        </button>
                    )}
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-slate-950">
                        <tr>
                            <SortableHeader
                                field="navn"
                                label="Virksomhet"
                                currentSort={sortBy}
                                sortOrder={sortOrder}
                                onSort={handleSort}
                            />
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                                Org.nr
                            </th>
                            <SortableHeader
                                field="konkursdato"
                                label="Konkursdato"
                                currentSort={sortBy}
                                sortOrder={sortOrder}
                                onSort={handleSort}
                            />
                            <SortableHeader
                                field="antall_ansatte"
                                label="Ansatte"
                                currentSort={sortBy}
                                sortOrder={sortOrder}
                                onSort={handleSort}
                                className="text-right"
                            />
                            <SortableHeader
                                field="naeringskode"
                                label="Bransje"
                                currentSort={sortBy}
                                sortOrder={sortOrder}
                                onSort={handleSort}
                            />
                            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 dark:text-slate-400">
                                Kommune
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                        {filteredData.length === 0 && searchQuery ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-slate-400">
                                    Ingen resultater for «{searchQuery}»
                                </td>
                            </tr>
                        ) : (
                            filteredData.map((company) => (
                                <tr
                                    key={company.orgnr}
                                    onClick={() => onSelectCompany(company.orgnr)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault()
                                            onSelectCompany(company.orgnr)
                                        }
                                    }}
                                    tabIndex={0}
                                    className="cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-500/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-900 dark:focus-visible:ring-blue-300"
                                    aria-label={`Åpne ${company.navn || 'virksomhet'} (${company.orgnr})`}
                                >
                                    <td className="px-4 py-3">
                                        <span className="font-medium text-gray-900 dark:text-white">{company.navn}</span>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-sm text-gray-600 dark:text-slate-300">
                                        {company.orgnr}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/15 dark:text-red-200">
                                            {company.konkursdato || '—'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-slate-300">
                                        {company.antall_ansatte ?? '—'}
                                    </td>
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500 dark:text-slate-300">
                                        {formatNace(company.naeringskode) || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-slate-300">
                                        {company.forretningsadresse?.kommune || '—'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Empty state */}
            {companies?.length === 0 && (
                <div className="p-8 text-center text-gray-500 dark:text-slate-400">
                    Ingen konkurser funnet i perioden
                </div>
            )}
        </div>
    )
}
