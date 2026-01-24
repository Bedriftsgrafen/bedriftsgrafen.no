import { createLazyFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'
import { SEOHead } from '../components/layout'
import { FilterPanel } from '../components/FilterPanel'
import { CONTACT_EMAIL } from '../constants/contact'
import { CompanyList } from '../components/CompanyList'
import { Pagination } from '../components/common'
import { ExportButton } from '../components/explorer'
import { AffiliateBanner } from '../components/ads/AffiliateBanner'
import { useFilterParams } from '../hooks/useFilterParams'
import { useCompaniesQuery } from '../hooks/queries/useCompaniesQuery'
import { useCompanyCountQuery } from '../hooks/queries/useCompanyCountQuery'
import { useUiStore } from '../store/uiStore'
import { useExplorerStore } from '../store/explorerStore'
import { useFilterStore } from '../store/filterStore'
import { useSlowLoadingToast } from '../hooks/useSlowLoadingToast'
import { ExplorerSearchBar } from '../components/explorer/ExplorerSearchBar'
import { ViewModeToggle } from '../components/explorer'

export const Route = createLazyFileRoute('/utforsk')({
    component: UtforskPage,
})

function UtforskPage() {
    const navigate = Route.useNavigate()
    const { q } = Route.useSearch()

    // UI state
    const itemsPerPage = useUiStore(s => s.itemsPerPage)
    const currentPage = useUiStore(s => s.currentPage)
    const addRecentSearch = useUiStore(s => s.addRecentSearch)
    const viewMode = useExplorerStore(s => s.viewMode)

    // Filter state
    const { filterParams, sortBy, sortOrder } = useFilterParams()
    const setSort = useFilterStore(s => s.setSort)
    const setSearchQuery = useFilterStore(s => s.setSearchQuery)

    // Sync global search query and history
    useEffect(() => {
        // ALWAYS update the store, even if q is missing (to handle clearing)
        setSearchQuery(q || '')
        if (q) {
            addRecentSearch(q)
        }
    }, [q, setSearchQuery, addRecentSearch])

    // Queries
    const skip = (currentPage - 1) * itemsPerPage
    const {
        data: companies = [],
        isLoading: companiesLoading,
        isError: companiesError,
        refetch: refetchCompanies
    } = useCompaniesQuery({
        skip,
        limit: itemsPerPage,
        ...filterParams,
        sort_by: sortBy,
        sort_order: sortOrder
    })

    const {
        data: totalCount,
        isLoading: countLoading
    } = useCompanyCountQuery(filterParams)

    // Feedback for slow loading
    useSlowLoadingToast(companiesLoading, 'Henter bedrifter. Dette kan ta litt tid...')

    // Handlers
    const handleSearch = useCallback((query: string) => {
        const trimmed = query.trim()

        // If 9-digit number, navigate directly to company page
        if (/^\d{9}$/.test(trimmed)) {
            navigate({ to: '/bedrift/$orgnr', params: { orgnr: trimmed } })
            return
        }

        navigate({ to: '/utforsk', search: { q: trimmed || undefined } })
    }, [navigate])

    const handleSelectCompany = useCallback((orgnr: string) => {
        navigate({ to: '/bedrift/$orgnr', params: { orgnr } })
    }, [navigate])

    const handleSortChange = useCallback((field: string) => {
        if (sortBy === field) {
            setSort(field, sortOrder === 'asc' ? 'desc' : 'asc')
        } else {
            const isNumber = ['revenue', 'profit', 'antall_ansatte', 'operating_profit'].includes(field)
            setSort(field, isNumber ? 'desc' : 'asc')
        }
    }, [sortBy, sortOrder, setSort])

    // Pagination handlers
    const { setPage } = useUiStore()
    const handlePreviousPage = useCallback(() => {
        setPage(Math.max(1, currentPage - 1))
    }, [currentPage, setPage])

    const handleNextPage = useCallback(() => {
        setPage(currentPage + 1)
    }, [currentPage, setPage])

    return (
        <>
            <SEOHead
                title="Utforsk bedrifter | Bedriftsgrafen.no"
                description="Søk og filtrer blant alle norske bedrifter. Finn informasjon om omsetning, ansatte, bransje og mer."
            />

            {/* Page header */}
            <div className="mb-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="w-full sm:w-auto flex-1 max-w-2xl">
                        <h1 className="text-3xl font-bold text-black mb-2">
                            Utforsk bedrifter
                        </h1>
                        <p className="text-gray-700 text-lg mb-4">
                            Søk, filtrer og analyser norske bedrifter.
                        </p>

                        <div className="flex flex-col md:flex-row items-center gap-4">
                            <div className="w-full flex-1">
                                <ExplorerSearchBar
                                    initialValue={q || ''}
                                    onSearch={handleSearch}
                                    isLoading={companiesLoading}
                                />
                            </div>
                            <ViewModeToggle />
                        </div>
                    </div>

                    <div className="shrink-0">
                        <ExportButton totalCount={totalCount} />
                    </div>
                </div>
            </div>

            <FilterPanel />

            <div id="company-table" className="mb-8">
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

            {!companiesError && companies.length > 0 && (
                <div className="mb-12">
                    <Pagination
                        currentPage={currentPage}
                        totalCount={totalCount || 0}
                        itemsPerPage={itemsPerPage}
                        currentItemsCount={companies.length}
                        onPreviousPage={handlePreviousPage}
                        onNextPage={handleNextPage}
                        onPageChange={setPage}
                    />
                </div>
            )}

            <AffiliateBanner
                bannerId="utforsk_bottom_placeholder"
                placement="utforsk_bottom"
                title="Vil du nå ut til norske bedrifter?"
                description="Vi åpner nå for utvalgte samarbeidspartnere. Ta kontakt for å vite mer om mulighetene."
                buttonText="Bli partner"
                link={`mailto:${CONTACT_EMAIL}`}
                variant="general"
            />
        </>
    )
}
