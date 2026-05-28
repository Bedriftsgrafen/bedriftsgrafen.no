import { useCallback, useMemo, memo, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Map } from 'lucide-react'
import { ExplorerFilters } from './ExplorerFilters'
import { ExplorerStats } from './ExplorerStats'
import { logger } from '../../utils/logger'
import { SortSelect } from './SortSelect'
import { ExportButton } from './ExportButton'
import { ViewModeToggle } from './ViewModeToggle'
import { CompanyList } from '../CompanyList'
import { Pagination } from '../common'
import { ActiveFilterChips } from '../filter/ActiveFilterChips'
import { useFilterParams } from '../../hooks/useFilterParams'
import { useExplorerShortcuts } from '../../hooks/useExplorerShortcuts'
import { useCompaniesQuery } from '../../hooks/queries/useCompaniesQuery'
import { useCompanyStatsQuery } from '../../hooks/queries/useCompanyStatsQuery'
import { useUiStore } from '../../store/uiStore'
import { useFilterStore, type FilterValues } from '../../store/filterStore'
import { useExplorerStore } from '../../store/explorerStore'
import { isNumericSortField } from '../../constants/explorer'
import { ComparisonModal } from '../comparison'
import { formatNumber, cleanOrgnr } from '../../utils/formatters'
import type { MapFilterValues } from '../../types/map'

/** Props for ExplorerLayout */
interface ExplorerLayoutProps {
    /** Optional callback when a company is selected - if not provided, navigates to company page */
    onSelectCompany?: (orgnr: string) => void
    /** Optional route-level filter sync for pages that keep filters in URL params */
    onFilterChange?: (updates: Partial<MapFilterValues>) => void
    /** Optional route-level clear handler for pages that keep filters in URL params */
    onClearFilters?: () => void
}

/**
 * Main layout for the explorer page.
 * Two-column responsive layout with filter sidebar and results area.
 */
export const ExplorerLayout = memo(function ExplorerLayout({ onSelectCompany, onFilterChange, onClearFilters }: ExplorerLayoutProps) {
    const navigate = useNavigate()

    // UI state - selective subscriptions for minimal re-renders
    const itemsPerPage = useUiStore((s) => s.itemsPerPage)
    const currentPage = useUiStore((s) => s.currentPage)
    const setPage = useUiStore((s) => s.setPage)

    // Filter state - inline check to avoid getActiveFilterCount() which uses get() internally
    const hasActiveFilters = useFilterStore((s) =>
        !!(s.searchQuery || s.organizationForms.length > 0 || s.naeringskode ||
            s.municipality || s.municipalityCode || s.county || s.countyCode ||
            s.revenueMin !== null || s.revenueMax !== null || s.profitMin !== null || s.profitMax !== null ||
            s.equityMin !== null || s.equityMax !== null || s.operatingProfitMin !== null || s.operatingProfitMax !== null ||
            s.liquidityRatioMin !== null || s.liquidityRatioMax !== null || s.equityRatioMin !== null || s.equityRatioMax !== null ||
            s.employeeMin !== null || s.employeeMax !== null || s.foundedFrom !== null || s.foundedTo !== null ||
            s.bankruptFrom !== null || s.bankruptTo !== null || s.isBankrupt !== null ||
            s.inLiquidation !== null || s.inForcedLiquidation !== null || s.hasAccounting !== null)
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
                if ('county' in mapFilter) updates.county = mapFilter.county || '';
                if ('county_code' in mapFilter) updates.countyCode = mapFilter.county_code || '';
                if ('municipality' in mapFilter) updates.municipality = mapFilter.municipality || '';
                if ('municipality_code' in mapFilter) updates.municipalityCode = mapFilter.municipality_code || '';
                if ('nace' in mapFilter) updates.naeringskode = mapFilter.nace || '';

                if (Object.keys(updates).length > 0) {
                    // Use setMapFilters to clear stale location filters first
                    setMapFilters(updates);
                }
            } catch (e) {
                logger.error('Failed to parse mapFilter:', e);
            } finally {
                sessionStorage.removeItem('mapFilter');
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

    const {
        data: stats,
        isLoading: statsLoading
    } = useCompanyStatsQuery({
        ...filterParams,
        sort_by: sortBy,
    })

    const totalCount = stats?.total_count;
    const countLoading = statsLoading;


    // Handlers - memoized for stable references
    const handleSelectCompany = useCallback(
        (orgnr: string) => {
            const clean = cleanOrgnr(orgnr)
            // Validate orgnr format (9 digits)
            if (!clean || !/^\d{9}$/.test(clean)) {
                logger.error('Invalid orgnr format:', orgnr)
                return
            }
            // Use prop callback if provided (enables modal behavior), otherwise navigate
            if (onSelectCompany) {
                onSelectCompany(clean)
            } else {
                navigate({ to: '/virksomhet/$orgnr', params: { orgnr: clean } })
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
    useEffect(() => {
        if (companiesError && companiesErrorData) {
            logger.error('Companies query error:', companiesErrorData)
        }
    }, [companiesError, companiesErrorData])

    return (
        <div className="flex flex-col lg:flex-row gap-6 relative z-0">
            {/* Sidebar - Filters */}
            <aside className="lg:w-80 shrink-0">
                <div className="lg:sticky lg:top-4">
                    <ExplorerFilters onFilterChange={onFilterChange} onClearFilters={onClearFilters} />
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
                <ExplorerStats
                    stats={stats}
                    isLoading={statsLoading}
                    isError={!!statsLoading && !stats} // Simplified for now
                />

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
                                {' '}<span className="hidden xs:inline">virksomheter</span>
                            </span>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                        <button
                            onClick={() => {
                                const state = useFilterStore.getState();
                                navigate({
                                    to: '/bransjer',
                                    search: {
                                        tab: 'map',
                                        q: state.searchQuery || undefined,
                                        nace: state.naeringskode || undefined,
                                        county: state.county || undefined,
                                        county_code: state.countyCode || undefined,
                                        municipality: state.municipality || undefined,
                                        municipality_code: state.municipalityCode || undefined,
                                        org_form: state.organizationForms.length > 0 ? state.organizationForms : undefined,
                                        revenue_min: state.revenueMin ?? undefined,
                                        revenue_max: state.revenueMax ?? undefined,
                                        employee_min: state.employeeMin ?? undefined,
                                        employee_max: state.employeeMax ?? undefined,
                                        profit_min: state.profitMin ?? undefined,
                                        profit_max: state.profitMax ?? undefined,
                                        is_bankrupt: state.isBankrupt ?? undefined,
                                        has_accounting: state.hasAccounting ?? undefined,
                                        in_liquidation: state.inLiquidation ?? undefined,
                                        in_forced_liquidation: state.inForcedLiquidation ?? undefined,
                                    },
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
            <ComparisonModal />
        </div>
    )
})
