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
  onOpenIndustry
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
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <CompanyModalHeader
          company={company}
          isLoading={companyLoading}
          isError={companyError}
          copiedOrgnr={copiedOrgnr}
          onCopyOrgnr={onCopyOrgnr}
          onShare={onShare}
          onClose={onClose}
          onRetry={onRetryCompany}
        />

        {/* Content */}
        <div className="p-6">
          {companyLoading ? (
            <div className="space-y-4">
              <div className="h-32 bg-gray-200 rounded animate-pulse" />
              <ChartSkeleton />
            </div>
          ) : companyError ? (
            <ErrorMessage
              message="Kunne ikke laste bedriftsdata"
              onRetry={onRetryCompany}
            />
          ) : company ? (
            <>
              <ModalTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                hasAccountingData={company.regnskap.length > 0 && company.naeringskode !== '00.000'}
              />

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
                <RolesTab orgnr={company.orgnr} />
              )}
            </>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
