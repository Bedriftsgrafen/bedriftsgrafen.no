import { useCallback, useMemo, memo, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
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
import { useFilterStore } from '../../store/filterStore'
import { useExplorerStore } from '../../store/explorerStore'
import { isNumericSortField } from '../../constants/explorer'
import { ComparisonBar, ComparisonModal } from '../comparison'
import { formatNumber } from '../../utils/formatters'

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

    // Filter state - get all values needed for ActiveFilterChips
    const searchQuery = useFilterStore((s) => s.searchQuery)
    const organizationForms = useFilterStore((s) => s.organizationForms)
    const naeringskode = useFilterStore((s) => s.naeringskode)
    const municipality = useFilterStore((s) => s.municipality)
    const county = useFilterStore((s) => s.county)
    const revenueMin = useFilterStore((s) => s.revenueMin)
    const revenueMax = useFilterStore((s) => s.revenueMax)
    const profitMin = useFilterStore((s) => s.profitMin)
    const profitMax = useFilterStore((s) => s.profitMax)
    const equityMin = useFilterStore((s) => s.equityMin)
    const equityMax = useFilterStore((s) => s.equityMax)
    const employeeMin = useFilterStore((s) => s.employeeMin)
    const employeeMax = useFilterStore((s) => s.employeeMax)
    const foundedFrom = useFilterStore((s) => s.foundedFrom)
    const foundedTo = useFilterStore((s) => s.foundedTo)
    const bankruptFrom = useFilterStore((s) => s.bankruptFrom)
    const bankruptTo = useFilterStore((s) => s.bankruptTo)
    const isBankrupt = useFilterStore((s) => s.isBankrupt)
    const inLiquidation = useFilterStore((s) => s.inLiquidation)
    const inForcedLiquidation = useFilterStore((s) => s.inForcedLiquidation)
    const setSearchQuery = useFilterStore((s) => s.setSearchQuery)
    const setSort = useFilterStore((s) => s.setSort)
    const setMunicipality = useFilterStore((s) => s.setMunicipality)
    const setNaeringskode = useFilterStore((s) => s.setNaeringskode)
    const setCounty = useFilterStore((s) => s.setCounty)

    // Check for map filter from sessionStorage (region click from map)
    useEffect(() => {
        const mapFilterStr = sessionStorage.getItem('mapFilter');
        if (mapFilterStr) {
            try {
                const mapFilter = JSON.parse(mapFilterStr);
                if (mapFilter.county) {
                    setCounty(mapFilter.county);
                }
                if (mapFilter.municipality) {
                    setMunicipality(mapFilter.municipality);
                }
                if (mapFilter.nace) {
                    setNaeringskode(mapFilter.nace);
                }
                // Clear after applying
                sessionStorage.removeItem('mapFilter');
            } catch (e) {
                console.error('Failed to parse mapFilter:', e);
            }
        }
    }, [setMunicipality, setNaeringskode, setCounty]);

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

    // Memoized check for active filters
    const hasActiveFilters = useMemo(
        () =>
            Boolean(searchQuery) ||
            organizationForms.length > 0 ||
            Boolean(naeringskode) ||
            Boolean(municipality) ||
            revenueMin !== null ||
            revenueMax !== null ||
            profitMin !== null ||
            profitMax !== null ||
            equityMin !== null ||
            equityMax !== null ||
            employeeMin !== null ||
            employeeMax !== null ||
            foundedFrom !== null ||
            foundedTo !== null ||
            isBankrupt !== null ||
            inLiquidation !== null ||
            inForcedLiquidation !== null,
        [
            searchQuery,
            organizationForms,
            naeringskode,
            municipality,
            revenueMin,
            revenueMax,
            profitMin,
            profitMax,
            equityMin,
            equityMax,
            employeeMin,
            employeeMax,
            foundedFrom,
            foundedTo,
            isBankrupt,
            inLiquidation,
            inForcedLiquidation,
        ]
    )

    // Handlers - memoized for stable references
    const handleSelectCompany = useCallback(
        (orgnr: string) => {
            // Validate orgnr format (9 digits)
            if (!/^\d{9}$/.test(orgnr)) {
                console.error('Invalid orgnr format:', orgnr)
                return
            }
            // Use prop callback if provided (enables modal behavior), otherwise navigate
            if (onSelectCompany) {
                onSelectCompany(orgnr)
            } else {
                navigate({ to: '/bedrift/$orgnr', params: { orgnr } })
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

    const handleClearSearch = useCallback(() => {
        setSearchQuery('')
    }, [setSearchQuery])

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
                        <ActiveFilterChips
                            searchQuery={searchQuery}
                            organizationForms={organizationForms}
                            naeringskode={naeringskode}
                            municipality={municipality}
                            county={county}
                            revenueMin={revenueMin}
                            revenueMax={revenueMax}
                            profitMin={profitMin}
                            profitMax={profitMax}
                            equityMin={equityMin}
                            equityMax={equityMax}
                            employeeMin={employeeMin}
                            employeeMax={employeeMax}
                            foundedFrom={foundedFrom}
                            foundedTo={foundedTo}
                            bankruptFrom={bankruptFrom}
                            bankruptTo={bankruptTo}
                            isBankrupt={isBankrupt}
                            inLiquidation={inLiquidation}
                            inForcedLiquidation={inForcedLiquidation}
                            onClearSearch={handleClearSearch}
                        />
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
