/* eslint-disable react-refresh/only-export-components */
import { createLazyFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sparkles, BarChart3, List, Map, Building2, TrendingUp, Users, Calendar, Loader2 } from 'lucide-react'
import { useCompanyStatsQuery } from '../hooks/queries/useCompanyStatsQuery'
import { SEOHead } from '../components/layout'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { NewCompaniesList } from '../components/newcompanies'
import { MapFilterValues } from '../types/map'
import { CompanyModalOverlay } from '../components/company/CompanyModalOverlay'
import { CompanyListModal } from '../components/dashboard/CompanyListModal'
import { SummaryCard, TabButton, TabContainer } from '../components/common'
import { IndustryBreakdownStats } from '../components/dashboard/IndustryBreakdownStats'
import { formatNumber, formatCurrency, cleanOrgnr } from '../utils/formatters'
import { getStartingDate } from '../utils/dates'
import { API_BASE } from '../utils/apiClient'
import { PeriodSelector } from '../components/common/PeriodSelector'
import { RotatingAffiliateBanner } from '../components/ads/RotatingAffiliateBanner'
import { ALL_AFFILIATIONS } from '../constants/affiliations'
import { useFilterStore } from '../store/filterStore'
import {
    buildMapFilterStoreUpdates,
    buildMapFiltersFromRouteSearch,
    buildMapRouteFilterUpdates,
    buildMapRouteSearchUpdates,
    type MapRouteSearchFilters,
} from '../utils/mapRouteSearchSync'

// Lazy-load heavy components: IndustryMap (leaflet ~154KB), TrendChart (recharts ~325KB)
const IndustryMap = lazy(() => import('../components/maps/IndustryMap').then(m => ({ default: m.IndustryMap })))
const TrendChart = lazy(() => import('../components/dashboard/TrendChart').then(m => ({ default: m.TrendChart })))

export const Route = createLazyFileRoute('/nyetableringer')({
    component: NyetableringerPage,
})

// ============================================================================
// Main Component
// ============================================================================

function NyetableringerPage() {
    const {
        period = '1y',
        nace, q, county_code, municipality_code, org_form,
        revenue_min, revenue_max, employee_min, employee_max,
        profit_min, profit_max, is_bankrupt, has_accounting, in_liquidation,
        in_forced_liquidation, show_per_capita, county, municipality
    } = Route.useSearch()
    const navigate = Route.useNavigate()
    useDocumentTitle('Nyetableringer | Bedriftsgrafen.no')
    const [activeTab, setActiveTab] = useState<'list' | 'stats' | 'map'>('list')
    // eslint-disable-next-line @eslint-react/use-state -- intentional: wrapper adds cleanOrgnr transform
    const [selectedCompanyOrgnr, setRawSelectedCompanyOrgnr] = useState<string | null>(null)
    const setSelectedCompanyOrgnr = useCallback((orgnr: string | null) => {
        setRawSelectedCompanyOrgnr(cleanOrgnr(orgnr))
    }, [])
    const [selectedIndustry, setSelectedIndustry] = useState<{ code: string; name: string } | null>(null)

    const routeSearch = useMemo((): MapRouteSearchFilters => ({
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
    }), [q, nace, county, county_code, municipality, municipality_code, org_form, revenue_min, revenue_max, employee_min, employee_max, profit_min, profit_max, is_bankrupt, has_accounting, in_liquidation, in_forced_liquidation, show_per_capita])

    useEffect(() => {
        const current = useFilterStore.getState()
        const updates = buildMapRouteFilterUpdates(routeSearch, current, {
            clearMissing: true,
            moneyUnit: 'mnok',
            defaultOrganizationForms: ['AS'],
        })

        if (Object.keys(updates).length > 0) {
            current.setAllFilters(updates)
        }
    }, [routeSearch])

    // Map search params to MapFilterValues
    const mapFilters = useMemo((): MapFilterValues => ({
        ...buildMapFiltersFromRouteSearch(routeSearch, { moneyUnit: 'mnok', defaultOrganizationForms: ['AS'] }),
        foundedFrom: getStartingDate(period),
    }), [period, routeSearch])

    const handleFilterChange = useCallback((updates: Partial<MapFilterValues>) => {
        const storeUpdates = buildMapFilterStoreUpdates(updates)

        if (Object.keys(storeUpdates).length > 0) {
            useFilterStore.getState().setAllFilters(storeUpdates)
        }

        navigate({
            search: (prev) => {
                return { ...prev, ...buildMapRouteSearchUpdates(updates, { moneyUnit: 'mnok' }) }
            },
            replace: true
        })
    }, [navigate])

    const handleClearFilters = useCallback(() => {
        const store = useFilterStore.getState()
        store.clearFilters()
        store.setAllFilters({ organizationForms: ['AS'] })
        navigate({
            search: (prev) => ({ period: prev.period }),
            replace: true
        })
    }, [navigate])

    const foundedFrom = getStartingDate(period)
    const periodLabel = period === '30d' ? 'Siste 30 dager' : period === '90d' ? 'Siste 90 dager' : 'Siste 12 mnd'

    // Consolidated stats query using optimized hook
    const { data: statsData } = useCompanyStatsQuery({
        registered_from: foundedFrom,
        organisasjonsform: ['AS'],
        exclude_org_form: ['KBO'],
        municipality_code: municipality_code || undefined,
        county_code: county_code || undefined,
        naeringskode: nace || undefined,
        name: q || undefined
    })

    const count = statsData?.total_count ?? 0
    const stats = statsData

    // Fetch trend data
    const { data: trendData } = useQuery({
        queryKey: ['establishmentTrend', 12, municipality_code, county_code, nace, q],
        queryFn: async () => {
            const params = new URLSearchParams({
                metric: 'new_companies',
                months: '12'
            })
            if (municipality_code) params.set('municipality_code', municipality_code)
            if (county_code) params.set('county_code', county_code)
            if (nace) params.set('naeringskode', nace)
            if (q) params.set('name', q)

            const res = await fetch(`${API_BASE}/v1/stats/timeline?${params.toString()}`)
            if (!res.ok) throw new Error('Failed to fetch trend')
            return res.json()
        },
        staleTime: 1000 * 60 * 60, // 1 hour
    })

    // Stable callbacks for tabs
    const handleListTab = useCallback(() => setActiveTab('list'), [])
    const handleStatsTab = useCallback(() => setActiveTab('stats'), [])
    const handleMapTab = useCallback(() => setActiveTab('map'), [])
    const handleIndustryClick = useCallback((code: string, name: string) => {
        setSelectedIndustry({ code, name })
    }, [])

    return (
        <>
            <SEOHead
                title="Nyetablerte virksomheter i Norge | Bedriftsgrafen.no"
                description="Oversikt over nylig etablerte virksomheter i Norge. Se hvilke bransjer som vokser og hvor nye virksomheter etableres."
            />

            {/* Page header */}
            <div className="mb-6">
                <h1 className="mb-2 flex items-center gap-3 text-2xl font-bold text-black dark:text-white md:text-3xl">
                    <Sparkles className="h-7 w-7 md:h-8 md:w-8 text-green-500" />
                    Nyetableringer
                </h1>
                <p className="text-lg text-gray-700 dark:text-slate-300">
                    Oversikt over nye virksomheter etablert {periodLabel.toLowerCase()}.
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <SummaryCard
                    icon={<Building2 className="w-5 h-5" />}
                    label="Nye virksomheter"
                    value={formatNumber(count ?? 0)}
                    color="green"
                />
                <SummaryCard
                    icon={<Users className="w-5 h-5" />}
                    label="Nye arbeidsplasser"
                    value={formatNumber(stats?.total_employees ?? 0)}
                    color="blue"
                />
                <SummaryCard
                    icon={<TrendingUp className="w-5 h-5" />}
                    label="Samlet omsetning"
                    value={formatCurrency(stats?.total_revenue ?? 0)}
                    color="purple"
                />
                <SummaryCard
                    icon={<Calendar className="w-5 h-5" />}
                    label="Periode"
                    color="blue"
                    className="border-blue-100/50 shadow-md dark:border-blue-400/20"
                >
                    <PeriodSelector activePeriod={period} route="/nyetableringer" variant="compact" />
                </SummaryCard>
            </div>

            <RotatingAffiliateBanner
                placement="nyetableringer_top"
                candidates={ALL_AFFILIATIONS}
                className="mb-6"
            />

            {/* Tab navigation */}
            <TabContainer>
                <TabButton
                    active={activeTab === 'list'}
                    icon={<List size={18} />}
                    label="Liste"
                    onClick={handleListTab}
                    badge={count}
                    badgeColor="green"
                />
                <TabButton
                    active={activeTab === 'stats'}
                    icon={<BarChart3 size={18} />}
                    label="Statistikk"
                    onClick={handleStatsTab}
                />
                <TabButton
                    active={activeTab === 'map'}
                    icon={<Map size={18} />}
                    label="Kart"
                    onClick={handleMapTab}
                />
            </TabContainer>

            {/* Content */}
            <div className="min-h-100 md:min-h-150">
            {activeTab === 'list' && (
                <NewCompaniesList
                    onSelectCompany={setSelectedCompanyOrgnr}
                    registeredFrom={foundedFrom}
                    initialMunicipalityCode={municipality_code}
                    initialCountyCode={county_code}
                    initialNace={nace}
                />
            )}

            {activeTab === 'stats' && (
                <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-green-500" /></div>}>
                    <div className="space-y-6">
                        <TrendChart
                            data={trendData || []}
                            title="Nyetableringer per måned"
                            color="#22c55e"
                            gradientId="colorEstablishments"
                        />
                        <IndustryBreakdownStats
                            metric="new_last_year"
                            title="Nyetableringer etter bransje"
                            colorScheme="green"
                            onIndustryClick={handleIndustryClick}
                        />
                    </div>
                </Suspense>
            )}

            {activeTab === 'map' && (
                <Suspense fallback={<div className="flex h-200 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-green-500" /></div>}>
                    <div className="space-y-4">
                        <div className="relative h-225 overflow-hidden rounded-2xl border border-gray-100 shadow-sm dark:border-slate-800 md:h-200">
                            <IndustryMap
                                filters={mapFilters}
                                onFilterChange={handleFilterChange}
                                onClearFilters={handleClearFilters}
                                metric="new_last_year"
                                onCompanyClick={setSelectedCompanyOrgnr}
                                selectedNace={mapFilters.naceCode}
                                countyCodeFromExplorer={mapFilters.countyCode || undefined}
                                municipalityCodeFromExplorer={mapFilters.municipalityCode || undefined}
                                organizationForms={mapFilters.organizationForms}
                                revenueMin={mapFilters.revenueMin}
                                revenueMax={mapFilters.revenueMax}
                                profitMin={mapFilters.profitMin}
                                profitMax={mapFilters.profitMax}
                                equityMin={mapFilters.equityMin}
                                equityMax={mapFilters.equityMax}
                                operatingProfitMin={mapFilters.operatingProfitMin}
                                operatingProfitMax={mapFilters.operatingProfitMax}
                                liquidityRatioMin={mapFilters.liquidityRatioMin}
                                liquidityRatioMax={mapFilters.liquidityRatioMax}
                                equityRatioMin={mapFilters.equityRatioMin}
                                equityRatioMax={mapFilters.equityRatioMax}
                                employeeMin={mapFilters.employeeMin}
                                employeeMax={mapFilters.employeeMax}
                                foundedFrom={mapFilters.foundedFrom}
                                foundedTo={mapFilters.foundedTo}
                                bankruptFrom={mapFilters.bankruptFrom}
                                bankruptTo={mapFilters.bankruptTo}
                                isBankrupt={mapFilters.isBankrupt}
                                inLiquidation={mapFilters.inLiquidation}
                                inForcedLiquidation={mapFilters.inForcedLiquidation}
                                hasAccounting={mapFilters.hasAccounting}
                            />
                        </div>
                    </div>
                </Suspense>
            )}
            </div>

            {/* Company Modal */}
            {
                selectedCompanyOrgnr && (
                    <CompanyModalOverlay
                        orgnr={selectedCompanyOrgnr}
                        onClose={() => setSelectedCompanyOrgnr(null)}
                        onSelectCompany={setSelectedCompanyOrgnr}
                    />
                )
            }

            {/* Industry Companies Modal */}
            {
                selectedIndustry && (
                    <CompanyListModal
                        naceCode={selectedIndustry.code}
                        naceName={selectedIndustry.name}
                        filterType="new"
                        onClose={() => setSelectedIndustry(null)}
                    />
                )
            }
        </>
    )
}
