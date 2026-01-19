/**
 * New companies list component - displays recently established companies.
 * Features: sortable columns, employee count, bransje/kommune filters
 */

import { useMemo } from 'react'
import { ChevronLeft, ChevronRight, Search, Filter, X } from 'lucide-react'
import { SortableHeader } from '../common/SortableHeader'
import { formatNumber } from '../../utils/formatters'
import { RegionSelect } from '../common/RegionSelect'
import { LoadingState } from '../common/LoadingState'
import { ErrorState } from '../common/ErrorState'
import { useTableState } from '../../hooks/useTableState'
import { useCompaniesQuery } from '../../hooks/queries/useCompaniesQuery'
import { useCompanyCountQuery } from '../../hooks/queries/useCompanyCountQuery'


interface NewCompaniesListProps {
    onSelectCompany: (orgnr: string) => void
    foundedFrom: string
}

type SortField = 'navn' | 'stiftelsesdato' | 'antall_ansatte' | 'naeringskode'


export function NewCompaniesList({ onSelectCompany, foundedFrom }: NewCompaniesListProps) {
    const {
        page,
        searchQuery, setSearchQuery,
        sortBy, sortOrder, handleSort,
        filters, setFilter, resetFilters,
        showFilters, setShowFilters,
        itemsPerPage,
        activeFilterCount, hasActiveFilters,
        nextPage, prevPage
    } = useTableState<{ nace: string, county: string, municipality: string }, SortField>({
        initialSortBy: 'stiftelsesdato',
        initialFilters: { nace: '', county: '', municipality: '' }
    })


    // Fetch new companies with sorting and filters
    const { data: companies, isLoading, error } = useCompaniesQuery({
        skip: (page - 1) * itemsPerPage,
        limit: itemsPerPage,
        founded_from: foundedFrom,
        organisasjonsform: ['AS'],
        exclude_org_form: ['KBO'],
        sort_by: sortBy,
        sort_order: sortOrder,
        naeringskode: filters.nace || undefined, // undefined to skip parameter
        county: filters.county || undefined,
        municipality: filters.municipality || undefined
    })

    // Fetch total count with filters
    const { data: totalCount } = useCompanyCountQuery({
        founded_from: foundedFrom,
        organisasjonsform: ['AS'], // API expects array
        exclude_org_form: ['KBO'],
        naeringskode: filters.nace || undefined,
        county: filters.county || undefined,
        municipality: filters.municipality || undefined
    })

    const totalPages = totalCount ? Math.ceil(totalCount / itemsPerPage) : 1


    // Render sort indicator inline

    // Filter data locally by search query
    const filteredData = useMemo(() => {
        if (!companies) return []
        if (!searchQuery.trim()) return companies
        const query = searchQuery.toLowerCase()
        return companies.filter(
            c => (c.navn?.toLowerCase().includes(query) || c.orgnr.includes(query))
        )
    }, [companies, searchQuery])



    if (isLoading) {
        return <LoadingState message="Laster nyetableringer..." />
    }

    if (error) {
        return <ErrorState message="Kunne ikke laste nyetableringer" />
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header with search and filters */}
            <div className="px-4 py-3 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-sm text-gray-600">
                    Viser {filteredData.length} av {formatNumber(totalCount ?? 0)} nye selskaper
                </span>
                <div className="flex items-center gap-3">
                    {/* Filter button */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border transition-colors ${hasActiveFilters
                            ? 'bg-green-50 border-green-300 text-green-700'
                            : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <Filter className="w-4 h-4" />
                        Filtrer
                        {activeFilterCount > 0 && (
                            <span className="bg-green-500 text-white text-xs rounded-full px-1.5">{activeFilterCount}</span>
                        )}
                    </button>

                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Søk i listen..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-1.5 w-48 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={prevPage}
                            disabled={page === 1}
                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <span className="text-sm text-gray-600">
                            Side {page} av {totalPages}
                        </span>
                        <button
                            onClick={() => nextPage(totalPages)}
                            disabled={page >= totalPages}
                            className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Filter panel */}
            {showFilters && (
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">Bransje:</label>
                        <input
                            type="text"
                            placeholder="F.eks. 68"
                            value={filters.nace}
                            onChange={(e) => setFilter('nace', e.target.value)}
                            className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-green-500"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">Fylke:</label>
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
                        <label className="text-sm text-gray-600">Kommune:</label>
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
                            onClick={resetFilters}
                            className="flex items-center gap-1 text-sm text-green-600 hover:text-green-800"
                        >
                            <X className="w-4 h-4" />
                            Nullstill
                        </button>
                    )}
                </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50">
                        <tr>
                            <SortableHeader
                                field="navn"
                                label="Selskap"
                                currentSort={sortBy}
                                sortOrder={sortOrder}
                                onSort={handleSort}
                            />
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Org.nr
                            </th>
                            <SortableHeader
                                field="stiftelsesdato"
                                label="Stiftet"
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
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Kommune
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredData.length === 0 && searchQuery ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                    Ingen resultater for «{searchQuery}»
                                </td>
                            </tr>
                        ) : (
                            filteredData.map((company) => (
                                <tr
                                    key={company.orgnr}
                                    onClick={() => onSelectCompany(company.orgnr)}
                                    className="hover:bg-green-50 cursor-pointer transition-colors"
                                >
                                    <td className="px-4 py-3">
                                        <span className="font-medium text-gray-900">{company.navn}</span>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                                        {company.orgnr}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                            {company.stiftelsesdato || '—'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm text-gray-600">
                                        {company.antall_ansatte ?? '—'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">
                                        {company.naeringskode || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">
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
                <div className="p-8 text-center text-gray-500">
                    Ingen nye selskaper funnet i perioden
                </div>
            )}
        </div>
    )
}
