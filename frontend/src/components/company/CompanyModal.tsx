import { useState, useCallback } from 'react'
import type { CompanyWithAccounting, AccountingWithKpis } from '../../types'
import { ChartSkeleton } from '../skeletons/ChartSkeleton'
import { ErrorMessage } from '../ErrorMessage'
import { CompanyModalHeader } from './CompanyModalHeader'
import { ModalTabs, type TabType } from './ModalTabs'
import { Modal } from '../common/Modal'
import { OverviewTab } from './OverviewTab'
import { FinancialsTab } from './FinancialsTab'
import { SubUnitsTab } from './SubUnitsTab'
import { RolesTab } from './RolesTab'
import { SimilarCompanies } from './SimilarCompanies'
import { IndustryBenchmark } from './IndustryBenchmark'

interface CompanyModalProps {
  company: CompanyWithAccounting | undefined
  companyLoading: boolean
  companyError: boolean
  selectedYear: number | null
  onSelectYear: (year: number | null) => void
  kpiData: AccountingWithKpis | undefined
  kpiLoading: boolean
  kpiError: boolean
  copiedOrgnr: boolean
  onCopyOrgnr: (orgnr: string) => void
  onShare: () => void
  onClose: () => void
  onRetryCompany: () => void
  onRetryKpi: () => void
  onImport: (orgnr: string) => void
  isImporting: boolean
  onOpenIndustry?: (naceCode: string, description: string) => void
  onSelectCompany?: (orgnr: string) => void
}

export function CompanyModal({
  company,
  companyLoading,
  companyError,
  selectedYear,
  onSelectYear,
  kpiData,
  kpiLoading,
  kpiError,
  copiedOrgnr,
  onCopyOrgnr,
  onShare,
  onClose,
  onRetryCompany,
  onRetryKpi,
  onImport,
  isImporting,
  onOpenIndustry,
  onSelectCompany
}: CompanyModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('oversikt')

  // Memoize import handler to prevent FinancialsTab re-renders
  const handleImport = useCallback(() => {
    if (company) {
      onImport(company.orgnr)
    }
  }, [company, onImport])

  return (
    <Modal
      isOpen={!!company || companyLoading || companyError}
      onClose={onClose}
      width="w-full"
      maxWidth="max-w-6xl"
      padding={false}
    >
      <div className="flex flex-col h-[90vh] md:h-auto max-h-[90vh] min-h-[400px]">
        {/* Header - Pinned */}
        <CompanyModalHeader
          company={company}
          isLoading={companyLoading}
          copiedOrgnr={copiedOrgnr}
          onCopyOrgnr={onCopyOrgnr}
          onShare={onShare}
        />

        {/* Scrollable Area Handler */}
        <div className="flex-1 flex flex-col min-h-0">
          {companyLoading ? (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
              <div className="h-32 bg-gray-200 rounded animate-pulse" />
              <ChartSkeleton />
            </div>
          ) : companyError ? (
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <ErrorMessage
                message="Kunne ikke laste bedriftsdata"
                onRetry={onRetryCompany}
              />
            </div>
          ) : company ? (
            <>
              {/* Tabs - Pinned */}
              <div className="px-4 md:px-6 pt-4 md:pt-6 bg-white z-10">
                <ModalTabs
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  hasAccountingData={company.regnskap.length > 0 && company.naeringskode !== '00.000'}
                />
              </div>

              {/* Tab Content - Scrollable */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 pt-0 md:pt-0">
                {activeTab === 'oversikt' && (
                  <>
                    <OverviewTab company={company} onOpenIndustry={onOpenIndustry} />
                    <SimilarCompanies
                      orgnr={company.orgnr}
                    />
                  </>
                )}

                {activeTab === 'okonomi' && (
                  <FinancialsTab
                    company={company}
                    selectedYear={selectedYear}
                    onSelectYear={onSelectYear}
                    kpiData={kpiData}
                    kpiLoading={kpiLoading}
                    kpiError={kpiError}
                    onRetryKpi={onRetryKpi}
                    onImport={handleImport}
                    isImporting={isImporting}
                  />
                )}

                {activeTab === 'sammenligning' && (
                  <IndustryBenchmark company={company} />
                )}

                {activeTab === 'avdelinger' && (
                  <SubUnitsTab orgnr={company.orgnr} />
                )}

                {activeTab === 'roller' && (
                  <RolesTab orgnr={company.orgnr} onCompanyClick={onSelectCompany} />
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
