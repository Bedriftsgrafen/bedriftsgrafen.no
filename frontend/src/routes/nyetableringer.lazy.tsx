import { createLazyFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Sparkles, BarChart3, List, Map, Building2, TrendingUp, Users, Calendar } from 'lucide-react'
import { SEOHead } from '../components/layout'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { NewCompaniesList } from '../components/newcompanies'
import { IndustryMap } from '../components/maps/IndustryMap'
import { CompanyModalOverlay } from '../components/company/CompanyModalOverlay'
import { CompanyListModal } from '../components/dashboard/CompanyListModal'
import { SummaryCard, TabButton } from '../components/common'
import { IndustryBreakdownStats } from '../components/dashboard/IndustryBreakdownStats'
import { TrendChart } from '../components/dashboard/TrendChart'
import { formatNumber, formatCurrency } from '../utils/formatters'
import { getStartingDate } from '../utils/dates'
import { API_BASE } from '../utils/apiClient'
import { PeriodSelector } from '../components/common/PeriodSelector'
import { AffiliateBanner } from '../components/ads/AffiliateBanner'
import { AFFILIATIONS } from '../constants/affiliations'

export const Route = createLazyFileRoute('/nyetableringer')({
    component: NyetableringerPage,
})

// ============================================================================
// Types
// ============================================================================

interface NewCompaniesStats {
    total_employees: number
    total_revenue: number
}

// ============================================================================
// Main Component
// ============================================================================

function NyetableringerPage() {
    const { period = '1y' } = Route.useSearch()
    useDocumentTitle('Nyetableringer | Bedriftsgrafen.no')
    const [activeTab, setActiveTab] = useState<'list' | 'stats' | 'map'>('list')
    const [selectedCompanyOrgnr, setSelectedCompanyOrgnr] = useState<string | null>(null)
    const [selectedIndustry, setSelectedIndustry] = useState<{ code: string; name: string } | null>(null)

    const foundedFrom = getStartingDate(period)
    const periodLabel = period === '30d' ? 'Siste 30 dager' : period === '90d' ? 'Siste 90 dager' : 'Siste 12 mnd'

    // Fetch new companies count
    const { data: count } = useQuery<number>({
        queryKey: ['newCompaniesCount', foundedFrom],
        queryFn: async () => {
            const res = await fetch(
                `${API_BASE}/v1/companies/count?founded_from=${foundedFrom}&organisasjonsform=AS&exclude_org_form=KBO`
            )
            if (!res.ok) throw new Error('Failed to fetch count')
            return res.json()
        },
        staleTime: 1000 * 60 * 5,
    })

    // Fetch aggregate stats
    const { data: stats } = useQuery<NewCompaniesStats>({
        queryKey: ['newCompaniesStats', foundedFrom],
        queryFn: async () => {
            const res = await fetch(
                `${API_BASE}/v1/companies/stats?founded_from=${foundedFrom}&organisasjonsform=AS&exclude_org_form=KBO`
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
                title="Nyetablerte selskaper i Norge | Bedriftsgrafen.no"
                description="Oversikt over nylig etablerte aksjeselskaper i Norge. Se hvilke bransjer som vokser og hvor nye selskaper etableres."
            />

            {/* Page header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-black mb-2 flex items-center gap-3">
                    <Sparkles className="h-8 w-8 text-green-500" />
                    Nyetableringer
                </h1>
                <p className="text-gray-700 text-lg">
                    Oversikt over nye aksjeselskaper etablert {periodLabel.toLowerCase()}.
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                <SummaryCard
                    icon={<Building2 className="w-5 h-5" />}
                    label="Nye selskaper"
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
                    className="sm:col-span-1 lg:col-span-2 shadow-md border-blue-100/50"
                >
                    <PeriodSelector activePeriod={period} route="/nyetableringer" variant="compact" />
                </SummaryCard>
            </div>

            {/* Affiliate Banner - official Tjenestetorget affiliation for new companies */}
            <div className="mb-6">
                <AffiliateBanner
                    bannerId={`nyetableringer_${AFFILIATIONS.TJENESTETORGET_ACCOUNTANT.id}`}
                    placement="nyetableringer_page"
                    {...AFFILIATIONS.TJENESTETORGET_ACCOUNTANT}
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
            </div>

            {/* Content */}
            {activeTab === 'list' && (
                <NewCompaniesList onSelectCompany={setSelectedCompanyOrgnr} foundedFrom={foundedFrom} />
            )}

            {activeTab === 'stats' && (
                <div className="space-y-6">
                    <TrendChart
                        metric="new_companies"
                        title="Nyetableringer per måned"
                        color="#22c55e"
                        months={12}
                    />
                    <IndustryBreakdownStats
                        metric="new_last_year"
                        title="Nyetableringer etter bransje"
                        colorScheme="green"
                        onIndustryClick={handleIndustryClick}
                    />
                </div>
            )}

            {activeTab === 'map' && (
                <IndustryMap
                    metric="new_last_year"
                    onCompanyClick={setSelectedCompanyOrgnr}
                />
            )}

            {/* Company Modal */}
            {selectedCompanyOrgnr && (
                <CompanyModalOverlay
                    orgnr={selectedCompanyOrgnr}
                    onClose={() => setSelectedCompanyOrgnr(null)}
                />
            )}

            {/* Industry Companies Modal */}
            {selectedIndustry && (
                <CompanyListModal
                    naceCode={selectedIndustry.code}
                    naceName={selectedIndustry.name}
                    filterType="new"
                    onClose={() => setSelectedIndustry(null)}
                />
            )}
        </>
    )
}
