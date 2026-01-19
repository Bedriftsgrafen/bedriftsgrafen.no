import { createLazyFileRoute } from '@tanstack/react-router'
import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, BarChart3, List, Map, Building2, TrendingDown, Users, Calendar } from 'lucide-react'
import { SEOHead } from '../components/layout'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { BankruptcyList } from '../components/bankruptcy'
import { IndustryMap } from '../components/maps/IndustryMap'
import { CompanyModalOverlay } from '../components/company/CompanyModalOverlay'
import { CompanyListModal } from '../components/dashboard/CompanyListModal'
import { SummaryCard, TabButton } from '../components/common'
import { IndustryBreakdownStats } from '../components/dashboard/IndustryBreakdownStats'
import { TrendChart } from '../components/dashboard/TrendChart'
import { formatNumber, formatCurrency } from '../utils/formatters'
import { getOneYearAgo } from '../utils/dates'
import { API_BASE } from '../utils/apiClient'
import { AffiliateBanner } from '../components/ads/AffiliateBanner'
import { AFFILIATIONS } from '../constants/affiliations'

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
    useDocumentTitle('Konkurser | Bedriftsgrafen.no')
    const [activeTab, setActiveTab] = useState<'list' | 'stats' | 'map'>('list')
    const [selectedCompanyOrgnr, setSelectedCompanyOrgnr] = useState<string | null>(null)
    const [selectedIndustry, setSelectedIndustry] = useState<{ code: string; name: string } | null>(null)

    const oneYearAgo = getOneYearAgo()

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
                    Oversikt over selskaper som har gått konkurs det siste året.
                </p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                    value="Siste 12 mnd"
                    color="blue"
                />
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
                <BankruptcyList onSelectCompany={setSelectedCompanyOrgnr} />
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
                <IndustryMap
                    metric="bankrupt_count"
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
                    filterType="bankrupt"
                    onClose={() => setSelectedIndustry(null)}
                />
            )}
        </>
    )
}
