import { createLazyFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, BarChart3, List, Map, Building2, TrendingDown, Users, Calendar } from 'lucide-react'
import { SEOHead } from '../components/layout'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { BankruptcyList } from '../components/bankruptcy'
import { IndustryMap } from '../components/maps/IndustryMap'
import { MapFilterValues, defaultMapFilters } from '../types/map'
import { CompanyModalOverlay } from '../components/company/CompanyModalOverlay'
import { CompanyListModal } from '../components/dashboard/CompanyListModal'
import { SummaryCard, TabButton } from '../components/common'
import { IndustryBreakdownStats } from '../components/dashboard/IndustryBreakdownStats'
import { TrendChart } from '../components/dashboard/TrendChart'
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

export const Route = createLazyFileRoute('/konkurser')({
    component: KonkurserPage,
})

// ============================================================================
// Types
// ============================================================================

interface BankruptcyStats {
    total_employees: number
    total_revenue: number
}

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
    const [selectedCompanyOrgnr, _setSelectedCompanyOrgnr] = useState<string | null>(null)
    const setSelectedCompanyOrgnr = useCallback((orgnr: string | null) => {
        _setSelectedCompanyOrgnr(cleanOrgnr(orgnr))
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

    // Fetch bankruptcy count for stats
    const { data: count } = useQuery<number>({
        queryKey: ['bankruptcyCount', oneYearAgo],
        queryFn: async () => {
            const res = await fetch(
                `${API_BASE}/v1/companies/count?is_bankrupt=true&bankrupt_from=${oneYearAgo}`
            )
            if (!res.ok) throw new Error('Failed to fetch count')
            return res.json()
        },
        staleTime: 1000 * 60 * 5,
    })

    // Fetch aggregate stats
    const { data: stats } = useQuery<BankruptcyStats>({
        queryKey: ['bankruptcyStats', oneYearAgo],
        queryFn: async () => {
            const res = await fetch(
                `${API_BASE}/v1/companies/stats?is_bankrupt=true&bankrupt_from=${oneYearAgo}`
            )
            if (!res.ok) throw new Error('Failed to fetch stats')
            return res.json()
        },
        staleTime: 1000 * 60 * 5,
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
                description="Oversikt over nylige konkurser og tvangsoppløsninger i Norge. Se hvilke selskaper som har gått konkurs det siste året."
            />

            {/* Page header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-black mb-2 flex items-center gap-3">
                    <AlertTriangle className="h-8 w-8 text-red-500" />
                    Konkurser
                </h1>
                <p className="text-gray-700 text-lg">
                    Oversikt over selskaper som har gått konkurs {periodLabel.toLowerCase()}.
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
            <div className="flex gap-2 mb-6 border-b border-gray-200">
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
            </div>

            {/* Content */}
            {activeTab === 'list' && (
                <BankruptcyList onSelectCompany={setSelectedCompanyOrgnr} bankruptFrom={oneYearAgo} />
            )}

            {activeTab === 'stats' && (
                <div className="space-y-6">
                    <TrendChart
                        metric="bankruptcies"
                        title="Konkurser per måned"
                        color="#ef4444"
                        months={12}
                    />
                    <IndustryBreakdownStats
                        metric="bankruptcies_last_year"
                        title="Konkurser etter bransje"
                        colorScheme="red"
                        onIndustryClick={handleIndustryClick}
                    />
                </div>
            )}

            {activeTab === 'map' && (
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
            )}

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
