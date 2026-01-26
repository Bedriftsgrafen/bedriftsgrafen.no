/**
 * CompanyModalOverlay - Self-contained company modal for map overlay
 * 
 * Renders as an overlay without changing the URL. Used when opening
 * company details from the map to preserve map state.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { CompanyModal } from './CompanyModal'
import { IndustryModal } from './IndustryModal'
import type { TabType } from './ModalTabs'
import { useCompanyDetailQuery } from '../../hooks/queries/useCompanyDetailQuery'
import { useAccountingKpisQuery } from '../../hooks/queries/useAccountingKpisQuery'
import { useFetchCompanyMutation } from '../../hooks/mutations/useFetchCompanyMutation'
import { useCompanyModal } from '../../hooks/useCompanyModal'
import { useUiStore } from '../../store/uiStore'
import { ExternalLink } from 'lucide-react'
import { cleanOrgnr } from '../../utils/formatters'

interface CompanyModalOverlayProps {
    orgnr: string
    onClose: () => void
    onSelectCompany?: (orgnr: string) => void
}

interface IndustryModalState {
    isOpen: boolean
    naceCode: string | null
    description: string | null
}

export function CompanyModalOverlay({ orgnr: rawOrgnr, onClose, onSelectCompany }: CompanyModalOverlayProps) {
    const orgnr = cleanOrgnr(rawOrgnr) || rawOrgnr
    const navigate = useNavigate()
    const selectedYear = useUiStore(s => s.selectedYear)
    const setSelectedYear = useUiStore(s => s.setSelectedYear)
    const addRecentCompany = useUiStore(s => s.addRecentCompany)

    // Industry modal state
    const [industryModal, setIndustryModal] = useState<IndustryModalState>({
        isOpen: false,
        naceCode: null,
        description: null
    })

    const [activeTab, setActiveTab] = useState<TabType>('oversikt')
    const [prevOrgnr, setPrevOrgnr] = useState(orgnr)

    // Reset tab to overview when company (orgnr) changes
    if (orgnr !== prevOrgnr) {
        setPrevOrgnr(orgnr)
        setActiveTab('oversikt')
    }

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

    const { copiedOrgnr, handleCopyOrgnr, handleShare } = useCompanyModal({
        company: company ? { orgnr: company.orgnr, navn: company.navn ?? 'Ukjent' } : undefined
    })

    // Add to recent companies when loaded
    useEffect(() => {
        if (company && !companyLoading && !companyError) {
            addRecentCompany({
                orgnr: company.orgnr,
                navn: company.navn ?? 'Ukjent',
                organisasjonsform: company.organisasjonsform || 'Ukjent'
            })
        }
    }, [company, companyLoading, companyError, addRecentCompany])

    // Handlers
    const handleSelectYear = (year: number | null) => {
        setSelectedYear(year)
    }

    const handleOpenIndustry = (naceCode: string, description: string) => {
        // Open local industry modal with full code instead of navigating to 2-digit division
        setIndustryModal({
            isOpen: true,
            naceCode,
            description
        })
    }

    const handleCloseIndustry = () => {
        setIndustryModal({
            isOpen: false,
            naceCode: null,
            description: null
        })
    }

    const handleOpenFullPage = () => {
        navigate({ to: '/bedrift/$orgnr', params: { orgnr } })
    }

    return (
        <>
            {/* Optional floating button to open full page */}
            <div className="fixed top-20 right-4 z-1001">
                <button
                    onClick={handleOpenFullPage}
                    className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    title="Åpne fullside"
                >
                    <ExternalLink size={16} />
                    Åpne fullside
                </button>
            </div>

            <CompanyModal
                company={company}
                companyLoading={companyLoading}
                companyError={companyError}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                selectedYear={selectedYear}
                onSelectYear={handleSelectYear}
                kpiData={kpiData ?? undefined}
                kpiLoading={kpiLoading}
                kpiError={kpiError}
                copiedOrgnr={copiedOrgnr}
                onCopyOrgnr={handleCopyOrgnr}
                onShare={handleShare}
                onClose={onClose}
                onRetryCompany={refetchCompany}
                onRetryKpi={refetchKpi}
                onImport={(o) => fetchMutation.mutate({ orgnr: o })}
                isImporting={fetchMutation.isPending}
                onOpenIndustry={handleOpenIndustry}
                onSelectCompany={onSelectCompany}
            />

            <IndustryModal
                isOpen={industryModal.isOpen}
                naceCode={industryModal.naceCode}
                naceDescription={industryModal.description}
                onClose={handleCloseIndustry}
                onSelectCompany={onSelectCompany}
            />
        </>
    )
}
