import React, { useMemo, useEffect } from 'react'
import { TrendingUp, Database, Wallet, Info, Home, ChevronRight } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { CompanyWithAccounting, AccountingWithKpis } from '../../types'
import { formatDate } from '../../utils/formatters'
import { deduplicateAccountingsByYear } from '../../utils/accountingHelpers'
import { KpiDashboard } from '../KpiDashboard'
import { CompanyCharts } from '../CompanyCharts'
import { KpiCardSkeleton } from '../skeletons/KpiCardSkeleton'
import { ChartSkeleton } from '../skeletons/ChartSkeleton'
import { EmptyState } from '../EmptyState'
import { YearSelector } from './YearSelector'
import { CapitalInfoCard } from './CapitalInfoCard'
import { AffiliateBanner } from '../ads/AffiliateBanner'
import { CONTACT_EMAIL } from '../../constants/contact'
import { AFFILIATIONS } from '../../constants/affiliations'

// Constants
const REVENUE_THRESHOLD_HIGH = 10_000_000 // 10M NOK

interface FinancialsTabProps {
  company: CompanyWithAccounting
  selectedYear: number | null
  onSelectYear: (year: number) => void
  kpiData: AccountingWithKpis | undefined
  kpiLoading: boolean
  kpiError: boolean
  onRetryKpi: () => void
  onImport: () => void
  isImporting: boolean
}

// Logic helper extracted from render scope
function getAdConfig(company: CompanyWithAccounting) {
  const latestRevenue = company.regnskap.reduce(
    (max, r) => (r.salgsinntekter && r.salgsinntekter > max ? r.salgsinntekter : max),
    0
  )

  if (latestRevenue > REVENUE_THRESHOLD_HIGH) {
    return {
      id: "premium_banking_financials",
      title: "Tilbyr dere Private Banking?",
      description: `Nå ut til bedrifter med høy omsetning. Denne plassen er ledig for samarbeid. Kontakt oss på ${CONTACT_EMAIL}.`,
      buttonText: "Send e-post",
      icon: Wallet,
      variant: "banking" as const,
      link: `mailto:${CONTACT_EMAIL}`
    }
  }

  // Priority: Official Tjenestetorget affiliation for companies with few accounting records
  if (company.regnskap.length < 2) {
    const aff = AFFILIATIONS.TJENESTETORGET_ACCOUNTANT
    return {
      ...aff,
      id: `financials_${aff.id}`
    }
  }

  return null
}

export const FinancialsTab = React.memo(function FinancialsTab({
  company,
  selectedYear,
  onSelectYear,
  kpiData,
  kpiLoading,
  kpiError,
  onRetryKpi,
  onImport,
  isImporting
}: FinancialsTabProps) {

  // Filter accounting records to only show years with actual financial data
  const validAccountings = useMemo(() => {
    const rawFiltered = company.regnskap.filter(acc =>
      acc.salgsinntekter != null ||
      acc.aarsresultat != null ||
      acc.sum_eiendeler != null
    )
    const deduplicated = deduplicateAccountingsByYear(rawFiltered)
    return deduplicated.sort((a, b) => b.aar - a.aar)
  }, [company.regnskap])

  const adConfig = useMemo(() => getAdConfig(company), [company])

  // Auto-select latest year if none selected
  useEffect(() => {
    if (selectedYear === null && validAccountings.length > 0) {
      onSelectYear(validAccountings[0].aar)
    }
  }, [selectedYear, validAccountings, onSelectYear])

  return (
    <div className="space-y-8 animate-fade-in pb-8">
      {/* Premium UX: Subunit Context Note - Always visible for subunits */}
      {company.parent_orgnr && (
        <div className="bg-blue-50/40 border border-blue-100 rounded-lg p-4 flex items-start gap-3 shadow-sm">
          <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900/80">
            <p className="font-bold text-blue-900 mb-0.5">Underenhet</p>
            <p className="leading-relaxed">
              Dette er en underenhet. Offisielle regnskapstall rapporteres vanligvis konsolidert på hovedenhetens nivå.
              {validAccountings.length > 0 ? ' Spesifikke lokale tall for denne underenheten vises nedenfor.' : ''}
            </p>
            <Link 
              to="/bedrift/$orgnr" 
              params={{ orgnr: company.parent_orgnr }}
              search={(prev: Record<string, unknown>) => ({ ...prev, tab: 'okonomi' as const })}
              className="mt-2 inline-flex items-center text-sm font-medium text-blue-700 hover:text-blue-800 bg-blue-100/50 hover:bg-blue-100 px-3 py-1.5 rounded-md transition-colors w-fit"
            >
              <Home className="h-3.5 w-3.5" />
              Se hovedenhetens regnskap
              <ChevronRight className="h-3 w-3 ml-0.5" />
            </Link>
          </div>
        </div>
      )}

      {validAccountings.length === 0 ? (
        <section className="mb-6" aria-label="Manglende regnskapsdata">
          <EmptyState
            icon={Database}
            title="Ingen regnskapsdata"
            description="Denne bedriften har ingen lagrede regnskapsdata. Vil du hente data fra Brønnøysundregistrene?"
            action={{
              label: isImporting ? 'Henter...' : 'Hent regnskapsdata',
              onClick: onImport
            }}
          />
        </section>
      ) : (
        <>
          {/* Capital Info Card - Company capital and corporate structure */}
          <CapitalInfoCard
            aksjekapital={company.aksjekapital}
            antallAksjer={company.antall_aksjer}
            sisteRegnskapsaar={company.siste_innsendte_aarsregnskap}
            erIKonsern={company.er_i_konsern}
            institusjonellSektor={company.institusjonell_sektor}
          />

          {/* Smart Affiliate Targeting */}
          {adConfig && (
            <div className="mb-2">
              <AffiliateBanner
                bannerId={adConfig.id}
                placement="financials_tab"
                title={adConfig.title}
                description={adConfig.description}
                buttonText={adConfig.buttonText}
                link={adConfig.link}
                icon={adConfig.icon}
                variant={adConfig.variant}
                isPlaceholder={adConfig.variant === 'banking'}
              />
            </div>
          )}

          {/* Year Selector */}
          <section aria-label="Velg regnskapsår">
            <YearSelector
              accountings={validAccountings}
              selectedYear={selectedYear}
              onSelectYear={onSelectYear}
            />
          </section>

          {/* KPI Dashboard */}
          {selectedYear && (
            <section aria-labelledby="kpi-heading" className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600 shrink-0" aria-hidden="true" />
                  <h2 id="kpi-heading" className="text-xl font-semibold text-gray-900">
                    Nøkkeltall {selectedYear}
                  </h2>
                </div>
                {company.last_polled_regnskap && (
                  <span className="text-xs text-gray-500">
                    Oppdatert: {formatDate(company.last_polled_regnskap)}
                  </span>
                )}
              </div>

              <div className="min-h-[200px]" aria-live="polite" aria-busy={kpiLoading}>
                {kpiLoading ? (
                  <KpiCardSkeleton />
                ) : kpiError ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 flex items-start gap-3">
                    <Database className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Mangler detaljerte nøkkeltall</h4>
                      <p className="text-sm mt-1 opacity-90">
                        Vi fant ikke detaljerte nøkkeltall for {selectedYear}. Dette kan skyldes at året ikke er ferdigstilt eller manglende data fra Brønnøysundregistrene.
                      </p>
                      <button
                        onClick={onRetryKpi}
                        className="text-sm font-medium underline mt-2 hover:text-yellow-900"
                      >
                        Prøv på nytt
                      </button>
                    </div>
                  </div>
                ) : kpiData ? (
                  <KpiDashboard data={kpiData} />
                ) : (
                  <div className="h-40 flex items-center justify-center text-gray-400 border border-dashed rounded-lg">
                    Laster nøkkeltall...
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Charts */}
          {validAccountings.length > 0 && (
            <section aria-labelledby="charts-heading">
              <h2 id="charts-heading" className="text-xl font-semibold text-gray-900 mb-4">
                Historisk Utvikling
              </h2>
              <div className="min-h-[300px]">
                {kpiLoading ? <ChartSkeleton height={300} /> : <CompanyCharts company={company} />}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
})
