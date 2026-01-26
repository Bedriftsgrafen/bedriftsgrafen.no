import { createLazyFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { CompanyModal } from '../components/company'
import { IndustryModal } from '../components/company/IndustryModal'
import { SEOHead, Breadcrumbs } from '../components/layout'
import { useCompanyDetailQuery } from '../hooks/queries/useCompanyDetailQuery'
import { useAccountingKpisQuery } from '../hooks/queries/useAccountingKpisQuery'
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

export const Route = createLazyFileRoute('/bedrift/$orgnr')({
    component: CompanyPage,
})

function CompanyPage() {
    const navigate = Route.useNavigate()
    const { orgnr } = Route.useParams()
    const search = Route.useSearch() as CompanySearch

    // Active tab is driven by URL, defaulting to 'oversikt'
    const activeTab = search.tab || 'oversikt'

    const selectedYear = useUiStore(s => s.selectedYear)
    const setSelectedYear = useUiStore(s => s.setSelectedYear)
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
    } = useAccountingKpisQuery(orgnr, selectedYear)

    const fetchMutation = useFetchCompanyMutation()

    // Slow loading feedback
    useSlowLoadingToast(companyLoading, 'Henter bedriftsinformasjon...')
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

    // Handlers - wrapped in useCallback for stable references
    const handleClose = useCallback(() => {
        // Navigate back in history to preserve context
        if (window.history.length > 1) {
            window.history.back()
        } else {
            navigate({ to: '/' })
        }
    }, [navigate])

    const handleSelectYear = useCallback((year: number | null) => {
        setSelectedYear(year)
    }, [setSelectedYear])

    const handleTabChange = useCallback((tab: TabType) => {
        navigate({
            to: '/bedrift/$orgnr',
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
            to: '/bedrift/$orgnr',
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

            <Breadcrumbs
                items={[
                    { label: 'Hjem', to: '/' },
                    { label: company?.navn || orgnr },
                ]}
            />

            <CompanyModal
                company={company}
                companyLoading={companyLoading}
                companyError={companyError}
                activeTab={activeTab}
                onTabChange={handleTabChange}
                selectedYear={selectedYear}
                onSelectYear={handleSelectYear}
                kpiData={kpiData ?? undefined}
                kpiLoading={kpiLoading}
                kpiError={kpiError}
                copiedOrgnr={copiedOrgnr}
                onCopyOrgnr={handleCopyOrgnr}
                onShare={handleShare}
                onClose={handleClose}
                onRetryCompany={refetchCompany}
                onRetryKpi={refetchKpi}
                onImport={(o) => fetchMutation.mutate({ orgnr: o })}
                isImporting={fetchMutation.isPending}
                onOpenIndustry={handleOpenIndustry}
                onSelectCompany={handleSelectCompany}
            />

            <IndustryModal
                isOpen={industryModal.isOpen}
                naceCode={industryModal.naceCode}
                naceDescription={industryModal.description}
                onClose={handleCloseIndustry}
            />
        </>
    )
}