/* eslint-disable react-refresh/only-export-components */
import { createLazyFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, BarChart3, List, Map, Building2, TrendingDown, Users, Calendar, Loader2 } from 'lucide-react'
import { useCompanyStatsQuery } from '../hooks/queries/useCompanyStatsQuery'
import { SEOHead } from '../components/layout'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { BankruptcyList } from '../components/bankruptcy'
import { MapFilterValues, defaultMapFilters } from '../types/map'
import { CompanyModalOverlay } from '../components/company/CompanyModalOverlay'
import { CompanyListModal } from '../components/dashboard/CompanyListModal'
import { SummaryCard, TabButton, TabContainer } from '../components/common'
import { IndustryBreakdownStats } from '../components/dashboard/IndustryBreakdownStats'
import { formatNumber, formatCurrency, cleanOrgnr } from '../utils/formatters'
import { getStartingDate } from '../utils/dates'
import { API_BASE } from '../utils/apiClient'
import { PeriodSelector } from '../components/common/PeriodSelector'
import { AffiliateBanner } from '../components/ads/AffiliateBanner'
import { AFFILIATIONS } from '../constants/affiliations'
import { useFilterStore, FilterValues } from '../store/filterStore'
import { COUNTIES } from '../constants/explorer'
import { MUNICIPALITIES } from '../constants/municipalityCodes'
import { mnokToNok } from '../utils/financials'

// Lazy-load heavy components: IndustryMap (leaflet ~154KB), TrendChart (recharts ~325KB)
const IndustryMap = lazy(() => import('../components/maps/IndustryMap').then(m => ({ default: m.IndustryMap })))
const TrendChart = lazy(() => import('../components/dashboard/TrendChart').then(m => ({ default: m.TrendChart })))

export const Route = createLazyFileRoute('/konkurser')({
    component: KonkurserPage,
})

// ============================================================================
// Main Component
// ============================================================================

function KonkurserPage() {
    const {
        period = '1y',
        nace, q, county_code, municipality_code, org_form,
        revenue_min, revenue_max, employee_min, employee_max,
        profit_min, profit_max, is_bankrupt = true, has_accounting, in_liquidation
    } = Route.useSearch()
    const navigate = Route.useNavigate()
    useDocumentTitle('Konkurser | Bedriftsgrafen.no')
    const [activeTab, setActiveTab] = useState<'list' | 'stats' | 'map'>('list')
    // eslint-disable-next-line @eslint-react/use-state -- intentional: wrapper adds cleanOrgnr transform
    const [selectedCompanyOrgnr, setRawSelectedCompanyOrgnr] = useState<string | null>(null)
    const setSelectedCompanyOrgnr = useCallback((orgnr: string | null) => {
        setRawSelectedCompanyOrgnr(cleanOrgnr(orgnr))
    }, [])
    const [selectedIndustry, setSelectedIndustry] = useState<{ code: string; name: string } | null>(null)

    // Read filter state from store
    const { naeringskode, searchQuery, setSearchQuery } = useFilterStore()

    // Sync search query between store and URL
    useEffect(() => {
        if (q !== undefined && q !== searchQuery) {
            setSearchQuery(q || '')
        }
    }, [q, searchQuery, setSearchQuery])

    // Map search params to MapFilterValues
    const mapFilters = useMemo((): MapFilterValues => ({
        ...defaultMapFilters,
        query: q || searchQuery || null,
        naceCode: nace || naeringskode || null,
        countyCode: county_code || null,
        municipalityCode: municipality_code || null,
        organizationForms: !org_form ? [] : (Array.isArray(org_form) ? org_form : [org_form as string]),
        revenueMin: revenue_min != null ? mnokToNok(revenue_min) ?? null : null,
        revenueMax: revenue_max != null ? mnokToNok(revenue_max) ?? null : null,
        profitMin: profit_min != null ? mnokToNok(profit_min) ?? null : null,
        profitMax: profit_max != null ? mnokToNok(profit_max) ?? null : null,
        employeeMin: employee_min || null,
        employeeMax: employee_max || null,
        isBankrupt: is_bankrupt ?? null,
        hasAccounting: has_accounting ?? null,
        inLiquidation: in_liquidation ?? null,
        bankruptFrom: getStartingDate(period),
    }), [period, q, nace, county_code, municipality_code, org_form, revenue_min, revenue_max, profit_min, profit_max, employee_min, employee_max, is_bankrupt, has_accounting, in_liquidation, naeringskode, searchQuery])

    const handleFilterChange = useCallback((updates: Partial<MapFilterValues>) => {
        // Sync with filterStore
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

        if (Object.keys(storeUpdates).length > 0) {
            useFilterStore.setState(storeUpdates)
        }

        navigate({
            search: (prev) => {
                const newSearch = { ...prev }
                if ('query' in updates) newSearch.q = updates.query || undefined
                if ('naceCode' in updates) newSearch.nace = updates.naceCode || undefined
                if ('countyCode' in updates) {
                    newSearch.county_code = updates.countyCode || undefined
                    newSearch.municipality_code = undefined
                    newSearch.county = updates.countyCode ? COUNTIES.find(c => c.code === updates.countyCode)?.name : undefined
                }
                if ('municipalityCode' in updates) {
                    newSearch.municipality_code = updates.municipalityCode || undefined
                    newSearch.municipality = updates.municipalityCode ? MUNICIPALITIES.find(m => m.code === updates.municipalityCode)?.name : undefined
                }
                if ('organizationForms' in updates) newSearch.org_form = (updates.organizationForms && updates.organizationForms.length > 0) ? updates.organizationForms : undefined

                if ('revenueMin' in updates) newSearch.revenue_min = updates.revenueMin != null ? updates.revenueMin / 1_000_000 : undefined
                if ('revenueMax' in updates) newSearch.revenue_max = updates.revenueMax != null ? updates.revenueMax / 1_000_000 : undefined
                if ('profitMin' in updates) newSearch.profit_min = updates.profitMin != null ? updates.profitMin / 1_000_000 : undefined
                if ('profitMax' in updates) newSearch.profit_max = updates.profitMax != null ? updates.profitMax / 1_000_000 : undefined
                if ('employeeMin' in updates) newSearch.employee_min = updates.employeeMin ?? undefined
                if ('employeeMax' in updates) newSearch.employee_max = updates.employeeMax ?? undefined
                if ('isBankrupt' in updates) newSearch.is_bankrupt = updates.isBankrupt ?? undefined
                if ('hasAccounting' in updates) newSearch.has_accounting = updates.hasAccounting ?? undefined
                if ('inLiquidation' in updates) newSearch.in_liquidation = updates.inLiquidation ?? undefined

                return newSearch
            },
            replace: true
        })
    }, [navigate])

    const handleClearFilters = useCallback(() => {
        useFilterStore.getState().clearFilters()
        navigate({
            search: (prev) => ({ period: prev.period }),
            replace: true
        })
    }, [navigate])

    const oneYearAgo = getStartingDate(period)
    const periodLabel = period === '30d' ? 'Siste 30 dager' : period === '90d' ? 'Siste 90 dager' : 'Siste 12 mnd'

    // Consolidated stats query using optimized hook
    const { data: statsData } = useCompanyStatsQuery({
        is_bankrupt: true,
        bankrupt_from: oneYearAgo,
        municipality_code: municipality_code || undefined,
        county_code: county_code || undefined,
        naeringskode: nace || undefined,
        name: q || undefined
    })

    const count = statsData?.total_count ?? 0
    const stats = statsData

    // Fetch trend data
    const { data: trendData } = useQuery({
        queryKey: ['bankruptcyTrend', 12, municipality_code, county_code, nace, q],
        queryFn: async () => {
            const params = new URLSearchParams({
                metric: 'bankruptcies',
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
                title="Konkurser i Norge | Bedriftsgrafen.no"
                description="Oversikt over nylige konkurser og tvangsoppløsninger i Norge. Se hvilke virksomheter som har gått konkurs det siste året."
            />

            {/* Page header */}
            <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-black mb-2 flex items-center gap-3">
                    <AlertTriangle className="h-7 w-7 md:h-8 md:w-8 text-red-500" />
                    Konkurser
                </h1>
                <p className="text-gray-700 text-lg">
                    Oversikt over virksomheter som har gått konkurs {periodLabel.toLowerCase()}.
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <SummaryCard
                    icon={<Building2 className="w-5 h-5" />}
                    label="Konkurser siste år"
                    value={formatNumber(count ?? 0)}
                    color="red"
                />
                <SummaryCard
                    icon={<Users className="w-5 h-5" />}
                    label="Ansatte berørt"
                    value={formatNumber(stats?.total_employees ?? 0)}
                    color="orange"
                />
                <SummaryCard
                    icon={<TrendingDown className="w-5 h-5" />}
                    label="Tapt omsetning"
                    value={formatCurrency(stats?.total_revenue ?? 0)}
                    color="red"
                />
                <SummaryCard
                    icon={<Calendar className="w-5 h-5" />}
                    label="Periode"
                    color="blue"
                    className="sm:col-span-1 lg:col-span-2 shadow-md border-blue-100/50"
                >
                    <PeriodSelector activePeriod={period} route="/konkurser" variant="compact" />
                </SummaryCard>
            </div>

            {/* Affiliate Banner - contextual for users browsing bankruptcies (potential fresh start) */}
            <div className="mb-6">
                <AffiliateBanner
                    bannerId={`konkurser_${AFFILIATIONS.TJENESTETORGET_ACCOUNTANT.id}`}
                    placement="konkurser_page"
                    {...AFFILIATIONS.TJENESTETORGET_ACCOUNTANT}
                    title="Behov for ny start?"
                    description="Få en god start på ditt neste prosjekt. Sammenlign regnskapsførere som hjelper deg fra dag én."
                />
            </div>

            {/* Tab navigation */}
            <TabContainer>
                <TabButton
                    active={activeTab === 'list'}
                    icon={<List size={18} />}
                    label="Liste"
                    onClick={handleListTab}
                    badge={count}
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
            <div className="min-h-[400px] md:min-h-[600px]">
            {activeTab === 'list' && (
                <BankruptcyList
                    onSelectCompany={setSelectedCompanyOrgnr}
                    bankruptFrom={oneYearAgo}
                    initialMunicipalityCode={municipality_code}
                    initialCountyCode={county_code}
                    initialNace={nace}
                />
            )}

            {activeTab === 'stats' && (
                <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-red-500" /></div>}>
                    <div className="space-y-6">
                        <TrendChart
                            data={trendData || []}
                            title="Konkurser per måned"
                            color="#ef4444"
                            gradientId="colorBankruptcies"
                        />
                        <IndustryBreakdownStats
                            metric="bankruptcies_last_year"
                            title="Konkurser etter bransje"
                            colorScheme="red"
                            onIndustryClick={handleIndustryClick}
                        />
                    </div>
                </Suspense>
            )}

            {activeTab === 'map' && (
                <Suspense fallback={<div className="flex items-center justify-center h-[800px]"><Loader2 className="h-8 w-8 animate-spin text-red-500" /></div>}>
                    <div className="space-y-4">
                        <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm h-[900px] md:h-[800px] relative">
                            <IndustryMap
                                filters={mapFilters}
                                onFilterChange={handleFilterChange}
                                onClearFilters={handleClearFilters}
                                metric="bankrupt_count"
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
            {selectedCompanyOrgnr && (
                <CompanyModalOverlay
                    orgnr={selectedCompanyOrgnr}
                    onClose={() => setSelectedCompanyOrgnr(null)}
                    onSelectCompany={setSelectedCompanyOrgnr}
                />
            )}

            {/* Industry Companies Modal */}
            {selectedIndustry && (
                <CompanyListModal
                    naceCode={selectedIndustry.code}
                    naceName={selectedIndustry.name}
                    filterType="bankrupt"
                    onClose={() => setSelectedIndustry(null)}
                />
            )}
        </>
    )
}
