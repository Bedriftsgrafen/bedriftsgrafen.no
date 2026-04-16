/* eslint-disable react-refresh/only-export-components */
import { createLazyFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { CompanyDetailContent } from '../components/company/CompanyDetailContent'
import { IndustryModal } from '../components/company/IndustryModal'
import { SEOHead, Breadcrumbs } from '../components/layout'
import { useCompanyDetailQuery } from '../hooks/queries/useCompanyDetailQuery'
import { useAccountingKpisByIdQuery } from '../hooks/queries/useAccountingKpisQuery'
import { useFetchCompanyMutation } from '../hooks/mutations/useFetchCompanyMutation'
import { useCompanyModal } from '../hooks/useCompanyModal'
import { useUiStore } from '../store/uiStore'
import { useSlowLoadingToast } from '../hooks/useSlowLoadingToast'
import type { TabType } from '../components/company/ModalTabs'

// Search params for the company page
export interface CompanySearch {
    tab?: TabType
}

// Industry modal state
interface IndustryModalState {
    isOpen: boolean
    naceCode: string | null
    description: string | null
}

export const Route = createLazyFileRoute('/virksomhet/$orgnr')({
    component: CompanyPage,
})

export function CompanyPage() {
    const navigate = Route.useNavigate()
    const { orgnr } = Route.useParams()
    const search = Route.useSearch() as CompanySearch

    // Active tab is driven by URL, defaulting to 'oversikt'
    const activeTab = search.tab || 'oversikt'

    const selectedYear = useUiStore(s => s.selectedYear)
    const selectedAccountingId = useUiStore(s => s.selectedAccountingId)
    const setSelectedAccounting = useUiStore(s => s.setSelectedAccounting)
    const addRecentCompany = useUiStore(s => s.addRecentCompany)

    // Industry modal state
    const [industryModal, setIndustryModal] = useState<IndustryModalState>({
        isOpen: false,
        naceCode: null,
        description: null
    })

    // Queries
    const {
        data: company,
        isLoading: companyLoading,
        isError: companyError,
        refetch: refetchCompany
    } = useCompanyDetailQuery(orgnr, true)

    const {
        data: kpiData,
        isLoading: kpiLoading,
        isError: kpiError,
        refetch: refetchKpi
    } = useAccountingKpisByIdQuery(orgnr, selectedAccountingId)

    const fetchMutation = useFetchCompanyMutation()

    // Auto-select the most recent accounting period when company data loads
    useEffect(() => {
        if (company?.regnskap?.length && !selectedAccountingId) {
            const mostRecent = company.regnskap[0]
            if (mostRecent?.id != null) {
                setSelectedAccounting(mostRecent.aar, mostRecent.id)
            }
        }
    }, [company, selectedAccountingId, setSelectedAccounting])

    // Slow loading feedback
    useSlowLoadingToast(companyLoading, 'Henter virksomhetsinformasjon...')
    useSlowLoadingToast(kpiLoading, 'Kalkulerer nøkkeltall...')

    const { copiedOrgnr, handleCopyOrgnr, handleShare } = useCompanyModal({
        company: company ? { orgnr: company.orgnr, navn: company.navn ?? 'Ukjent' } : undefined
    })

    // Add to recent companies
    useEffect(() => {
        if (company && !companyLoading && !companyError) {
            addRecentCompany({
                orgnr: company.orgnr,
                navn: company.navn ?? 'Ukjent',
                organisasjonsform: company.organisasjonsform || 'Ukjent'
            })
        }
    }, [company, companyLoading, companyError, addRecentCompany])

    const handleSelectAccounting = useCallback((year: number, accountingId: number) => {
        setSelectedAccounting(year, accountingId)
    }, [setSelectedAccounting])

    const handleTabChange = useCallback((tab: TabType) => {
        navigate({
            to: '/virksomhet/$orgnr',
            params: { orgnr },
            search: (prev: Record<string, unknown>) => ({ ...prev, tab }),
            replace: true
        })
    }, [navigate, orgnr])

    const handleOpenIndustry = useCallback((naceCode: string, description: string) => {
        // Open local industry modal with full code instead of navigating away
        setIndustryModal({
            isOpen: true,
            naceCode,
            description
        })
    }, [])

    const handleCloseIndustry = useCallback(() => {
        setIndustryModal({
            isOpen: false,
            naceCode: null,
            description: null
        })
    }, [])

    const handleSelectCompany = useCallback((newOrgnr: string) => {
        // When selecting a related company, preserve the active tab
        navigate({
            to: '/virksomhet/$orgnr',
            params: { orgnr: newOrgnr },
            search: (prev: Record<string, unknown>) => ({ ...prev, tab: 'oversikt' }),
            replace: true
        })
    }, [navigate])

    return (
        <>
            <SEOHead
                companyName={company?.navn}
                orgnr={orgnr}
                companyData={company ? {
                    address: company.forretningsadresse || company.postadresse,
                    hjemmeside: company.hjemmeside,
                    stiftelsesdato: company.stiftelsesdato,
                    antall_ansatte: company.antall_ansatte,
                } : undefined}
            />

            <div className="max-w-7xl mx-auto px-4 lg:px-6 pb-8">
                <Breadcrumbs
                    items={[
                        { label: 'Hjem', to: '/' },
                        { label: company?.navn || orgnr },
                    ]}
                />

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 mt-2">
                    <CompanyDetailContent
                        company={company}
                        companyLoading={companyLoading}
                        companyError={companyError}
                        activeTab={activeTab}
                        onTabChange={handleTabChange}
                        selectedYear={selectedYear}
                        selectedAccountingId={selectedAccountingId}
                        onSelectAccounting={handleSelectAccounting}
                        kpiData={kpiData ?? undefined}
                        kpiLoading={kpiLoading}
                        kpiError={kpiError}
                        copiedOrgnr={copiedOrgnr}
                        onCopyOrgnr={handleCopyOrgnr}
                        onShare={handleShare}
                        onRetryCompany={refetchCompany}
                        onRetryKpi={refetchKpi}
                        onImport={(o) => fetchMutation.mutate({ orgnr: o })}
                        isImporting={fetchMutation.isPending}
                        onOpenIndustry={handleOpenIndustry}
                        onSelectCompany={handleSelectCompany}
                        constrainHeight={false}
                    />
                </div>
            </div>

            <IndustryModal
                isOpen={industryModal.isOpen}
                naceCode={industryModal.naceCode}
                naceDescription={industryModal.description}
                onClose={handleCloseIndustry}
            />
        </>
    )
}