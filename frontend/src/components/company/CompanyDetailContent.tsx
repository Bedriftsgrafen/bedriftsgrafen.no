import { useCallback, useRef, useEffect } from 'react'
import type { CompanyWithAccounting, AccountingWithKpis } from '../../types'
import { ChartSkeleton } from '../skeletons/ChartSkeleton'
import { ErrorMessage } from '../ErrorMessage'
import { CompanyModalHeader } from './CompanyModalHeader'
import { ModalTabs, type TabType } from './ModalTabs'
import { OverviewTab } from './OverviewTab'
import { FinancialsTab } from './FinancialsTab'
import { SubUnitsTab } from './SubUnitsTab'
import { RolesTab } from './RolesTab'
import { SimilarCompanies } from './SimilarCompanies'
import { IndustryBenchmark } from './IndustryBenchmark'

export interface CompanyDetailContentProps {
  company: CompanyWithAccounting | undefined
  companyLoading: boolean
  companyError: boolean
  selectedYear: number | null
  selectedAccountingId: number | null
  onSelectAccounting: (year: number, accountingId: number) => void
  kpiData: AccountingWithKpis | undefined
  kpiLoading: boolean
  kpiError: boolean
  copiedOrgnr: boolean
  onCopyOrgnr: (orgnr: string) => void
  onShare: () => void
  onRetryCompany: () => void
  onRetryKpi: () => void
  onImport: (orgnr: string) => void
  isImporting: boolean
  onOpenIndustry?: (naceCode: string, description: string) => void
  onSelectCompany?: (orgnr: string) => void
  activeTab: TabType
  onTabChange: (tab: TabType) => void
  /** When true, uses fixed height with inner scroll (modal). When false, grows naturally (page). Default: true */
  constrainHeight?: boolean
  headingId?: string
  descriptionId?: string
}

export function CompanyDetailContent({
  company,
  companyLoading,
  companyError,
  selectedYear,
  selectedAccountingId,
  onSelectAccounting,
  kpiData,
  kpiLoading,
  kpiError,
  copiedOrgnr,
  onCopyOrgnr,
  onShare,
  onRetryCompany,
  onRetryKpi,
  onImport,
  isImporting,
  onOpenIndustry,
  onSelectCompany,
  activeTab,
  onTabChange,
  constrainHeight = true,
  headingId,
  descriptionId,
}: CompanyDetailContentProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to top when organization number changes (navigation between subunits/parent)
  useEffect(() => {
    if (company?.orgnr) {
      if (constrainHeight) {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'auto' })
      } else {
        window.scrollTo({ top: 0, behavior: 'auto' })
      }
    }
  }, [company?.orgnr, constrainHeight])

  // Memoize import handler to prevent FinancialsTab re-renders
  const handleImport = useCallback(() => {
    if (company) {
      onImport(company.orgnr)
    }
  }, [company, onImport])

  const outerClassName = constrainHeight
    ? 'flex flex-col h-[90vh] md:h-auto max-h-[90vh] min-h-[400px]'
    : 'flex flex-col min-h-[400px]'

  const scrollClassName = constrainHeight
    ? 'flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 md:p-6 pt-0 md:pt-0 animate-in fade-in duration-300 slide-in-from-bottom-2'
    : 'p-4 md:p-6 pt-0 md:pt-0 animate-in fade-in duration-300 slide-in-from-bottom-2'

  return (
    <div className={outerClassName}>
      {/* Header - Pinned */}
      <CompanyModalHeader
        company={company}
        isLoading={companyLoading}
        copiedOrgnr={copiedOrgnr}
        onCopyOrgnr={onCopyOrgnr}
        onShare={onShare}
        showCloseOverlap={constrainHeight}
        headingId={headingId}
        descriptionId={descriptionId}
      />

      {/* Content Area */}
      <div className={constrainHeight ? 'flex-1 flex flex-col min-h-0' : 'flex flex-col'}>
        {companyLoading ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4" role="status" aria-busy="true" aria-label="Laster virksomhetsdata">
            <div className="h-32 bg-gray-200 rounded animate-pulse" aria-hidden="true" />
            <ChartSkeleton />
          </div>
        ) : companyError ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            <ErrorMessage
              message="Kunne ikke laste virksomhetsdata"
              onRetry={onRetryCompany}
            />
          </div>
        ) : company ? (
          <>
            {/* Tabs */}
            <div className={`px-4 md:px-6 ${constrainHeight ? 'pt-4 md:pt-6 bg-white z-10' : 'pt-2 md:pt-3'}`}>
              <ModalTabs
                activeTab={activeTab}
                onTabChange={onTabChange}
                hasAccountingData={company.regnskap.length > 0 && company.naeringskode !== '00.000'}
                isSubunit={company.is_subunit}
              />
            </div>

            {/* Tab Content */}
            <div
              ref={constrainHeight ? scrollContainerRef : undefined}
              className={scrollClassName}
              key={company.orgnr}
              role="tabpanel"
              aria-label={activeTab}
            >
              {activeTab === 'oversikt' && (
                <>
                  <OverviewTab company={company} onOpenIndustry={onOpenIndustry} />
                  <SimilarCompanies orgnr={company.orgnr} />
                </>
              )}

              {activeTab === 'okonomi' && (
                <FinancialsTab
                  company={company}
                  selectedYear={selectedYear}
                  selectedAccountingId={selectedAccountingId}
                  onSelectAccounting={onSelectAccounting}
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
                <SubUnitsTab orgnr={company.orgnr} onSubUnitClick={onSelectCompany} />
              )}

              {activeTab === 'roller' && (
                <RolesTab orgnr={company.orgnr} onCompanyClick={onSelectCompany} />
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
