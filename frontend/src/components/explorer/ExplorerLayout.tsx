import { useCallback, useMemo, memo, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Map } from 'lucide-react'
import { ExplorerFilters } from './ExplorerFilters'
import { ExplorerStats } from './ExplorerStats'
import { SortSelect } from './SortSelect'
import { ExportButton } from './ExportButton'
import { ViewModeToggle } from './ViewModeToggle'
import { CompanyList } from '../CompanyList'
import { Pagination } from '../common'
import { ActiveFilterChips } from '../filter/ActiveFilterChips'
import { useFilterParams } from '../../hooks/useFilterParams'
import { useExplorerShortcuts } from '../../hooks/useExplorerShortcuts'
import { useCompaniesQuery } from '../../hooks/queries/useCompaniesQuery'
import { useCompanyCountQuery } from '../../hooks/queries/useCompanyCountQuery'
import { useUiStore } from '../../store/uiStore'
import { useFilterStore, type FilterValues } from '../../store/filterStore'
import { useExplorerStore } from '../../store/explorerStore'
import { isNumericSortField } from '../../constants/explorer'
import { ComparisonBar, ComparisonModal } from '../comparison'
import { formatNumber, cleanOrgnr } from '../../utils/formatters'

/** Props for ExplorerLayout */
interface ExplorerLayoutProps {
    /** Optional callback when a company is selected - if not provided, navigates to company page */
    onSelectCompany?: (orgnr: string) => void
}

/**
 * Main layout for the explorer page.
 * Two-column responsive layout with filter sidebar and results area.
 */
export const ExplorerLayout = memo(function ExplorerLayout({ onSelectCompany }: ExplorerLayoutProps) {
    const navigate = useNavigate()

    // UI state - selective subscriptions for minimal re-renders
    const itemsPerPage = useUiStore((s) => s.itemsPerPage)
    const currentPage = useUiStore((s) => s.currentPage)
    const setPage = useUiStore((s) => s.setPage)

    // Filter state - inline check to avoid getActiveFilterCount() which uses get() internally
    const hasActiveFilters = useFilterStore((s) =>
        !!(s.searchQuery || s.organizationForms.length > 0 || s.naeringskode ||
            s.municipality || s.municipalityCode || s.county || s.revenueMin !== null || s.revenueMax !== null ||
            s.employeeMin !== null || s.employeeMax !== null || s.isBankrupt !== null)
    )
    const setMapFilters = useFilterStore((s) => s.setMapFilters)
    const setSort = useFilterStore((s) => s.setSort)

    // Check for map filter from sessionStorage (region click from map)
    useEffect(() => {
        const mapFilterStr = sessionStorage.getItem('mapFilter');
        if (mapFilterStr) {
            try {
                const mapFilter = JSON.parse(mapFilterStr);
                const updates: Partial<FilterValues> = {};
                if (mapFilter.county) updates.county = mapFilter.county;
                if (mapFilter.county_code) updates.countyCode = mapFilter.county_code;
                if (mapFilter.municipality) updates.municipality = mapFilter.municipality;
                if (mapFilter.municipality_code) updates.municipalityCode = mapFilter.municipality_code;
                if (mapFilter.nace) updates.naeringskode = mapFilter.nace;

                if (Object.keys(updates).length > 0) {
                    // Use setMapFilters to clear stale location filters first
                    setMapFilters(updates);
                }
                // Clear after applying
                sessionStorage.removeItem('mapFilter');
            } catch (e) {
                console.error('Failed to parse mapFilter:', e);
            }
        }
    }, [setMapFilters]);

    // Explorer UI state
    const viewMode = useExplorerStore((s) => s.viewMode)

    // Keyboard shortcuts (L=list, K=cards, E=export)
    useExplorerShortcuts()


    const { filterParams, sortBy, sortOrder } = useFilterParams()

    // Queries
    const skip = useMemo(
        () => (currentPage - 1) * itemsPerPage,
        [currentPage, itemsPerPage]
    )

    const {
        data: companies = [],
        isLoading: companiesLoading,
        isError: companiesError,
        error: companiesErrorData,
        refetch: refetchCompanies,
    } = useCompaniesQuery({
        skip,
        limit: itemsPerPage,
        ...filterParams,
        sort_by: sortBy,
        sort_order: sortOrder,
    })

    const { data: totalCount, isLoading: countLoading } =
        useCompanyCountQuery(filterParams)


    // Handlers - memoized for stable references
    const handleSelectCompany = useCallback(
        (orgnr: string) => {
            const clean = cleanOrgnr(orgnr)
            // Validate orgnr format (9 digits)
            if (!clean || !/^\d{9}$/.test(clean)) {
                console.error('Invalid orgnr format:', orgnr)
                return
            }
            // Use prop callback if provided (enables modal behavior), otherwise navigate
            if (onSelectCompany) {
                onSelectCompany(clean)
            } else {
                navigate({ to: '/bedrift/$orgnr', params: { orgnr: clean } })
            }
        },
        [navigate, onSelectCompany]
    )

    const handleSortChange = useCallback(
        (field: string) => {
            if (sortBy === field) {
                setSort(field, sortOrder === 'asc' ? 'desc' : 'asc')
            } else {
                setSort(field, isNumericSortField(field) ? 'desc' : 'asc')
            }
        },
        [sortBy, sortOrder, setSort]
    )

    const handlePreviousPage = useCallback(() => {
        setPage(Math.max(1, currentPage - 1))
    }, [currentPage, setPage])

    const handleNextPage = useCallback(() => {
        const maxPage = totalCount ? Math.ceil(totalCount / itemsPerPage) : currentPage
        setPage(Math.min(maxPage, currentPage + 1))
    }, [currentPage, totalCount, itemsPerPage, setPage])


    // Log errors for debugging (in production, send to monitoring service)
    if (companiesError && companiesErrorData) {
        console.error('Companies query error:', companiesErrorData)
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 relative z-0">
            {/* Sidebar - Filters */}
            <aside className="lg:w-80 shrink-0">
                <div className="lg:sticky lg:top-4">
                    <ExplorerFilters />
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 min-w-0">
                {/* Active filters - only render when filters are active */}
                {hasActiveFilters && (
                    <div className="mb-4">
                        <ActiveFilterChips />
                    </div>
                )}

                {/* Stats cards */}
                <ExplorerStats />

                {/* Toolbar - Sort and count */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2 sm:px-4 sm:py-3 mb-4">
                    <div className="text-sm text-gray-600">
                        {countLoading ? (
                            <span className="animate-pulse">Laster...</span>
                        ) : (
                            <span>
                                <span className="font-medium text-gray-900">
                                    {totalCount !== undefined ? formatNumber(totalCount) : 0}
                                </span>
                                {' '}<span className="hidden xs:inline">selskaper</span>
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                        <button
                            onClick={() => {
                                // Store all active filters for map to pick up
                                const state = useFilterStore.getState();
                                sessionStorage.setItem('mapFilter', JSON.stringify({
                                    county: state.county || '',
                                    county_code: state.countyCode || '',
                                    municipality: state.municipality || '',
                                    municipality_code: state.municipalityCode || '',
                                    nace: state.naeringskode || '',
                                    org_form: state.organizationForms,
                                    revenue_min: state.revenueMin,
                                    revenue_max: state.revenueMax,
                                    employee_min: state.employeeMin,
                                    employee_max: state.employeeMax,
                                }))

                                navigate({
                                    to: '/bransjer',
                                    search: { tab: 'map', nace: state.naeringskode || undefined },
                                    replace: true
                                })
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-200 rounded-lg transition-colors mr-1 sm:mr-2"
                        >
                            <Map className="h-4 w-4" />
                            <span className="hidden sm:inline">Se i kart</span>
                        </button>
                        <ViewModeToggle />
                        <SortSelect />
                        <ExportButton totalCount={totalCount} />
                    </div>
                </div>

                {/* Results - CompanyList handles loading/error states */}
                <div className="mb-6">
                    <CompanyList
                        companies={companies}
                        isLoading={companiesLoading}
                        isError={companiesError}
                        onSelectCompany={handleSelectCompany}
                        onRetry={refetchCompanies}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        onSortChange={handleSortChange}
                        itemsPerPage={itemsPerPage}
                        totalCount={totalCount}
                        countLoading={countLoading}
                        viewMode={viewMode}
                    />
                </div>

                {/* Pagination - only show when we have results and no error */}
                {!companiesError && companies.length > 0 && (
                    <Pagination
                        currentPage={currentPage}
                        totalCount={totalCount ?? 0}
                        itemsPerPage={itemsPerPage}
                        currentItemsCount={companies.length}
                        onPreviousPage={handlePreviousPage}
                        onNextPage={handleNextPage}
                        onPageChange={setPage}
                    />
                )}
            </main>

            {/* Comparison UI */}
            <ComparisonBar />
            <ComparisonModal />
        </div>
    )
})
