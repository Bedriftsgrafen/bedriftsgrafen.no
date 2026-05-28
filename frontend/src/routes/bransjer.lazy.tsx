/* eslint-disable react-refresh/only-export-components */
import { createLazyFileRoute } from '@tanstack/react-router'
import { SEOHead } from '../components/layout'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { IndustryDashboard } from '../components/dashboard/IndustryDashboard'
import { IndustryTopList } from '../components/dashboard/IndustryTopList'
import { CompanyModalOverlay } from '../components/company/CompanyModalOverlay'
import { useMemo, useCallback, useEffect, lazy, Suspense } from 'react'
import { BarChart3, Search, Map, Award, Loader2 } from 'lucide-react'
import { TabButton, TabContainer } from '../components/common'
import { MapFilterValues, defaultMapFilters } from '../types/map'
import { useFilterStore } from '../store/filterStore'
import { formatMunicipalityName } from '../constants/municipalities'
import { cleanOrgnr } from '../utils/formatters'
import { buildBransjerRouteFilterUpdates } from '../utils/bransjerSearchSync'
import { buildMapFilterStoreUpdates, buildMapRouteSearchUpdates } from '../utils/mapRouteSearchSync'

// Lazy-load heavy components: IndustryMap (leaflet ~154KB) and ExplorerLayout (~56KB)
// Only downloaded when the user activates the corresponding tab
const IndustryMap = lazy(() => import('../components/maps/IndustryMap').then(m => ({ default: m.IndustryMap })))
const ExplorerLayout = lazy(() => import('../components/explorer').then(m => ({ default: m.ExplorerLayout })))

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
        profit_min, profit_max, is_bankrupt, has_accounting, in_liquidation, in_forced_liquidation,
        county, municipality, show_per_capita
    } = Route.useSearch()

    // Read filter state from store
    const { naeringskode, searchQuery } = useFilterStore()

    // Hydrate the explorer filter store from URL params used by bransjer deep links.
    useEffect(() => {
        const current = useFilterStore.getState()
        const updates = buildBransjerRouteFilterUpdates({
            q,
            nace,
            county,
            county_code,
            municipality,
            municipality_code,
            org_form,
            revenue_min,
            revenue_max,
            employee_min,
            employee_max,
            profit_min,
            profit_max,
            is_bankrupt,
            has_accounting,
            in_liquidation,
            in_forced_liquidation,
            show_per_capita,
        }, current, { clearMissing: tab === 'search' || tab === 'map' })

        if (Object.keys(updates).length > 0) {
            current.setAllFilters(updates)
        }
    }, [
        q,
        nace,
        county,
        county_code,
        municipality,
        municipality_code,
        org_form,
        revenue_min,
        revenue_max,
        employee_min,
        employee_max,
        profit_min,
        profit_max,
        is_bankrupt,
        has_accounting,
        in_liquidation,
        in_forced_liquidation,
        show_per_capita,
        tab,
    ])

    // Tab state persisted in URL - defaults to stats.
    const activeTab = useMemo(() => {
        if (tab) return tab as BransjerTab
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
        inForcedLiquidation: in_forced_liquidation ?? null,
        showPerCapita: show_per_capita ?? false,
    }), [q, searchQuery, nace, naeringskode, county_code, municipality_code, org_form, revenue_min, revenue_max, employee_min, employee_max, profit_min, profit_max, is_bankrupt, has_accounting, in_liquidation, in_forced_liquidation, show_per_capita])

    const handleFilterChange = useCallback((updates: Partial<MapFilterValues>) => {
        const storeUpdates = buildMapFilterStoreUpdates(updates)

        if (Object.keys(storeUpdates).length > 0) {
            useFilterStore.getState().setAllFilters(storeUpdates)
        }

        navigate({
            to: '/bransjer',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            search: (prev: any) => {
                return { ...prev, ...buildMapRouteSearchUpdates(updates) }
            },
            replace: true,
        })
    }, [navigate])

    const handleClearFilters = useCallback(() => {
        // Clear store too
        useFilterStore.getState().clearFilters()

        navigate({
            to: '/bransjer',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            search: (prev: any) => ({
                tab: prev.tab,
            }),
            replace: true,
        })
    }, [navigate])

    // Change tab by updating URL search params
    const setActiveTab = useCallback((newTab: BransjerTab) => {
        navigate({
            to: '/bransjer',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            search: (prev: any) => ({ ...prev, tab: newTab }),
            replace: true,
        })
    }, [navigate])

    const selectedCompanyOrgnr = cleanOrgnr(orgnr)

    const setSelectedCompanyOrgnr = useCallback((newOrgnr: string | null) => {
        const clean = cleanOrgnr(newOrgnr)
        navigate({
            to: '/bransjer',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            search: (prev: any) => ({ ...prev, orgnr: clean ?? undefined }),
            replace: true,
        })
    }, [navigate])

    // Handle search click from map - switch to search tab and store filter
    const handleMapSearchClick = useCallback((regionName: string, regionCode: string, naceCode: string | null) => {
        const cleanName = regionName.split(' - ')[0].trim()
        const normalizedName = formatMunicipalityName(cleanName)
        const isCounty = regionCode.length === 2

        navigate({
            to: '/bransjer',
            search: (prev: Record<string, unknown>) => ({
                ...prev,
                tab: 'search',
                nace: naceCode || undefined,
                county: isCounty ? normalizedName : undefined,
                county_code: isCounty ? regionCode : undefined,
                municipality: isCounty ? undefined : normalizedName,
                municipality_code: isCounty ? undefined : regionCode,
            }),
            replace: true,
        })
    }, [navigate])

    return (
        <>
            <SEOHead
                title="Utforsk bransjer | Bedriftsgrafen.no"
                description="Utforsk norske virksomheter etter bransje, region og virksomhetsform. Filtrer på omsetning, antall ansatte og mer."
            />

            {/* Page header */}
            <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-black mb-2">
                    Utforsk bransjer
                </h1>
                <p className="text-gray-700 text-lg">
                    Finn og analyser virksomheter etter bransje, område og finansielle kriterier.
                </p>
            </div>

            {/* Tab navigation */}
            <TabContainer>
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
                    label="Søk virksomheter"
                    onClick={() => setActiveTab('search')}
                />
            </TabContainer>

            {/* Content — min-height prevents CLS from footer shifting when data loads */}
            <div className="min-h-100 md:min-h-150 min-w-0 overflow-x-hidden">
            {activeTab === 'stats' && <IndustryDashboard initialNace={nace} />}
            {activeTab === 'map' && (
                <Suspense fallback={<div className="flex items-center justify-center h-200"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
                <div className="space-y-4">
                    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm h-225 md:h-200 relative">
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
                </Suspense>
            )}
            {activeTab === 'toplist' && <IndustryTopList naceCode={nace} onSelectCompany={setSelectedCompanyOrgnr} />}
            {activeTab === 'search' && (
                <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
                    <ExplorerLayout
                        onSelectCompany={setSelectedCompanyOrgnr}
                        onFilterChange={handleFilterChange}
                        onClearFilters={handleClearFilters}
                    />
                </Suspense>
            )}
            </div>

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
