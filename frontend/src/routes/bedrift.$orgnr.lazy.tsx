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

    const handleOpenIndustry = useCallback((naceCode: string, _description: string) => {
        // Navigate to bransjer page with NACE filter for better UX integration
        const naceDivision = naceCode.substring(0, 2) // Get 2-digit NACE division
        navigate({ to: '/bransjer', search: { nace: naceDivision } })
    }, [navigate])

    const handleCloseIndustry = useCallback(() => {
        setIndustryModal({
            isOpen: false,
            naceCode: null,
            description: null
        })
    }, [])

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
