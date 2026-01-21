import { createLazyFileRoute } from '@tanstack/react-router'
import { ExplorerLayout } from '../components/explorer'
import { SEOHead } from '../components/layout'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { IndustryDashboard } from '../components/dashboard/IndustryDashboard'
import { IndustryMap } from '../components/maps/IndustryMap'
import { IndustryTopList } from '../components/dashboard/IndustryTopList'
import { CompanyModalOverlay } from '../components/company/CompanyModalOverlay'
import { useMemo, useCallback, useEffect } from 'react'
import { BarChart3, Search, Map, Award } from 'lucide-react'
import { TabButton } from '../components/common'
import { MapFilterValues, defaultMapFilters } from '../types/map'
import { COUNTIES } from '../constants/explorer'
import { MUNICIPALITIES } from '../constants/municipalityCodes'
import { useFilterStore, FilterValues } from '../store/filterStore'
import { formatMunicipalityName } from '../constants/municipalities'
import { cleanOrgnr } from '../utils/formatters'

// Tab type for type safety
type BransjerTab = 'stats' | 'search' | 'map' | 'toplist'


export const Route = createLazyFileRoute('/bransjer')({
    component: BransjerPage,
})

function BransjerPage() {
    useDocumentTitle('Utforsk bransjer | Bedriftsgrafen.no')
    const navigate = Route.useNavigate()
    const {
        nace, tab, orgnr,
        q, county_code, municipality_code, org_form,
        revenue_min, revenue_max, employee_min, employee_max,
        profit_min, profit_max, is_bankrupt, has_accounting, in_liquidation,
        county, municipality
    } = Route.useSearch()

    // Read filter state from store
    const { naeringskode, searchQuery, setSearchQuery } = useFilterStore()

    // Sync search query between store and URL
    useEffect(() => {
        // If we have a query in the store but not in the URL, and it's not a fresh navigation to industrial dashboard
        // we might want to sync it. But more importantly, if the URL has a query, the store MUST have it.
        if (q !== undefined && q !== searchQuery) {
            setSearchQuery(q || '')
        }
    }, [q, searchQuery, setSearchQuery])

    // Tab state persisted in URL - defaults to 'stats' unless mapFilter is present at mount
    const activeTab = useMemo(() => {
        if (tab) return tab as BransjerTab
        if (typeof window !== 'undefined' && sessionStorage.getItem('mapFilter')) {
            return 'search'
        }
        return 'stats'
    }, [tab])

    // Map search params to MapFilterValues for the filter bar
    const filters = useMemo((): MapFilterValues => ({
        ...defaultMapFilters,
        query: q || searchQuery || null,
        naceCode: nace || naeringskode || null,
        countyCode: county_code || null,
        municipalityCode: municipality_code || null,
        organizationForms: Array.isArray(org_form)
            ? org_form
            : org_form
                ? [org_form as string]
                : [],
        revenueMin: revenue_min ?? null,
        revenueMax: revenue_max ?? null,
        employeeMin: employee_min ?? null,
        employeeMax: employee_max ?? null,
        profitMin: profit_min ?? null,
        profitMax: profit_max ?? null,
        isBankrupt: is_bankrupt ?? null,
        hasAccounting: has_accounting ?? null,
        inLiquidation: in_liquidation ?? null,
    }), [q, searchQuery, nace, naeringskode, county_code, municipality_code, org_form, revenue_min, revenue_max, employee_min, employee_max, profit_min, profit_max, is_bankrupt, has_accounting, in_liquidation])

    const handleFilterChange = useCallback((updates: Partial<MapFilterValues>) => {
        // Sync with filterStore for consistent list/stats views
        const storeUpdates: Partial<FilterValues> = {}
        if ('query' in updates) storeUpdates.searchQuery = updates.query || ''
        if ('naceCode' in updates) storeUpdates.naeringskode = updates.naceCode || ''
        if ('countyCode' in updates) storeUpdates.countyCode = updates.countyCode || ''
        if ('municipalityCode' in updates) storeUpdates.municipalityCode = updates.municipalityCode || ''
        if ('revenueMin' in updates) storeUpdates.revenueMin = updates.revenueMin
        if ('revenueMax' in updates) storeUpdates.revenueMax = updates.revenueMax
        if ('employeeMin' in updates) storeUpdates.employeeMin = updates.employeeMin
        if ('employeeMax' in updates) storeUpdates.employeeMax = updates.employeeMax
        if ('profitMin' in updates) storeUpdates.profitMin = updates.profitMin
        if ('profitMax' in updates) storeUpdates.profitMax = updates.profitMax
        if ('organizationForms' in updates) storeUpdates.organizationForms = updates.organizationForms || []
        if ('isBankrupt' in updates) storeUpdates.isBankrupt = updates.isBankrupt

        if (Object.keys(storeUpdates).length > 0) {
            useFilterStore.setState(storeUpdates)
        }

        navigate({
            to: '/bransjer',
            search: (prev) => {
                const newSearch: Record<string, unknown> = { ...prev }
                if ('query' in updates) newSearch.q = updates.query || undefined
                if ('naceCode' in updates) newSearch.nace = updates.naceCode || undefined
                if ('countyCode' in updates) {
                    newSearch.county_code = updates.countyCode || undefined
                    newSearch.county = updates.countyCode ? COUNTIES.find(c => c.code === updates.countyCode)?.name : undefined
                }
                if ('municipalityCode' in updates) {
                    newSearch.municipality_code = updates.municipalityCode || undefined
                    newSearch.municipality = updates.municipalityCode ? MUNICIPALITIES.find(m => m.code === updates.municipalityCode)?.name : undefined
                }
                if ('organizationForms' in updates) newSearch.org_form = updates.organizationForms?.length ? updates.organizationForms : undefined
                if ('revenueMin' in updates) newSearch.revenue_min = updates.revenueMin ?? undefined
                if ('revenueMax' in updates) newSearch.revenue_max = updates.revenueMax ?? undefined
                if ('employeeMin' in updates) newSearch.employee_min = updates.employeeMin ?? undefined
                if ('employeeMax' in updates) newSearch.employee_max = updates.employeeMax ?? undefined
                if ('profitMin' in updates) newSearch.profit_min = updates.profitMin ?? undefined
                if ('profitMax' in updates) newSearch.profit_max = updates.profitMax ?? undefined
                if ('isBankrupt' in updates) newSearch.is_bankrupt = updates.isBankrupt ?? undefined
                if ('hasAccounting' in updates) newSearch.has_accounting = updates.hasAccounting ?? undefined
                if ('inLiquidation' in updates) newSearch.in_liquidation = updates.inLiquidation ?? undefined
                return newSearch
            },
            replace: true,
        })
    }, [navigate])

    const handleClearFilters = useCallback(() => {
        // Clear store too
        useFilterStore.getState().clearFilters()

        navigate({
            to: '/bransjer',
            search: (prev) => ({
                tab: prev.tab,
            }),
            replace: true,
        })
    }, [navigate])

    // Change tab by updating URL search params
    const setActiveTab = useCallback((newTab: BransjerTab) => {
        navigate({
            to: '/bransjer',
            search: (prev) => ({ ...prev, tab: newTab }),
            replace: true,
        })
    }, [navigate])

    const selectedCompanyOrgnr = cleanOrgnr(orgnr)

    const setSelectedCompanyOrgnr = useCallback((newOrgnr: string | null) => {
        const clean = cleanOrgnr(newOrgnr)
        navigate({
            to: '/bransjer',
            search: (prev) => ({ ...prev, orgnr: clean ?? undefined }),
            replace: true,
        })
    }, [navigate])

    // Handle search click from map - switch to search tab and store filter
    const handleMapSearchClick = useCallback((regionName: string, regionCode: string, naceCode: string | null) => {
        const cleanName = regionName.split(' - ')[0].trim()
        const normalizedName = formatMunicipalityName(cleanName)
        const isCounty = regionCode.length === 2

        sessionStorage.setItem('mapFilter', JSON.stringify({
            county: isCounty ? normalizedName : '',
            county_code: isCounty ? regionCode : '',
            municipality: isCounty ? '' : normalizedName,
            municipality_code: isCounty ? '' : regionCode,
            nace: naceCode,
        }))
        setActiveTab('search')
    }, [setActiveTab])

    return (
        <>
            <SEOHead
                title="Utforsk bransjer | Bedriftsgrafen.no"
                description="Utforsk norske bedrifter etter bransje, region og selskapsform. Filtrer på omsetning, antall ansatte og mer."
            />

            {/* Page header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-black mb-2">
                    Utforsk bransjer
                </h1>
                <p className="text-gray-700 text-lg">
                    Finn og analyser bedrifter etter bransje, område og finansielle kriterier.
                </p>
            </div>

            {/* Tab navigation */}
            <div className="flex gap-2 mb-6 border-b border-gray-200">
                <TabButton
                    active={activeTab === 'stats'}
                    icon={<BarChart3 size={18} />}
                    label="Bransjestatistikk"
                    onClick={() => setActiveTab('stats')}
                />
                <TabButton
                    active={activeTab === 'map'}
                    icon={<Map size={18} />}
                    label="Bransjekart"
                    onClick={() => setActiveTab('map')}
                />
                <TabButton
                    active={activeTab === 'toplist'}
                    icon={<Award size={18} />}
                    label="Topplister"
                    onClick={() => setActiveTab('toplist')}
                />
                <TabButton
                    active={activeTab === 'search'}
                    icon={<Search size={18} />}
                    label="Søk bedrifter"
                    onClick={() => setActiveTab('search')}
                />
            </div>

            {/* Content */}
            {activeTab === 'stats' && <IndustryDashboard initialNace={nace} onSelectCompany={setSelectedCompanyOrgnr} />}
            {activeTab === 'map' && (
                <div className="space-y-4">
                    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm h-[900px] md:h-[800px] relative">
                        <IndustryMap
                            filters={filters}
                            onFilterChange={handleFilterChange}
                            onClearFilters={handleClearFilters}
                            selectedNace={filters.naceCode || naeringskode || undefined}
                            metric="company_count"
                            onSearchClick={handleMapSearchClick}
                            onCompanyClick={setSelectedCompanyOrgnr}
                            onRegionClick={(_name, code, level) => {
                                if (level === 'county') {
                                    handleFilterChange({ countyCode: code, municipalityCode: null })
                                } else {
                                    handleFilterChange({ municipalityCode: code })
                                }
                            }}
                            countyFromExplorer={county}
                            countyCodeFromExplorer={filters.countyCode || undefined}
                            municipalityFromExplorer={municipality}
                            municipalityCodeFromExplorer={filters.municipalityCode || undefined}
                            organizationForms={filters.organizationForms}
                            revenueMin={filters.revenueMin}
                            revenueMax={filters.revenueMax}
                            employeeMin={filters.employeeMin}
                            employeeMax={filters.employeeMax}
                            profitMin={filters.profitMin}
                            profitMax={filters.profitMax}
                            equityMin={filters.equityMin}
                            equityMax={filters.equityMax}
                            operatingProfitMin={filters.operatingProfitMin}
                            operatingProfitMax={filters.operatingProfitMax}
                            liquidityRatioMin={filters.liquidityRatioMin}
                            liquidityRatioMax={filters.liquidityRatioMax}
                            equityRatioMin={filters.equityRatioMin}
                            equityRatioMax={filters.equityRatioMax}
                            foundedFrom={filters.foundedFrom}
                            foundedTo={filters.foundedTo}
                            bankruptFrom={filters.bankruptFrom}
                            bankruptTo={filters.bankruptTo}
                            isBankrupt={filters.isBankrupt}
                            hasAccounting={filters.hasAccounting}
                            inLiquidation={filters.inLiquidation}
                            inForcedLiquidation={filters.inForcedLiquidation}
                            query={filters.query}
                        />
                    </div>
                </div>
            )}
            {activeTab === 'toplist' && <IndustryTopList naceCode={nace} onSelectCompany={setSelectedCompanyOrgnr} />}
            {activeTab === 'search' && <ExplorerLayout onSelectCompany={setSelectedCompanyOrgnr} />}

            {/* Company Modal Overlay - rendered when clicking company */}
            {selectedCompanyOrgnr && (
                <CompanyModalOverlay
                    orgnr={selectedCompanyOrgnr}
                    onClose={() => setSelectedCompanyOrgnr(null)}
                    onSelectCompany={setSelectedCompanyOrgnr}
                />
            )}
        </>
    )
}
