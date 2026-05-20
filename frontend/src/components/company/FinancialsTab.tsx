import React, { useMemo, useEffect } from 'react'
import { TrendingUp, Database, Info, Home, ChevronRight } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { CompanyWithAccounting, AccountingWithKpis } from '../../types'
import { formatDate } from '../../utils/formatters'
import { KpiDashboard } from '../KpiDashboard'
import { CompanyCharts } from '../CompanyCharts'
import { KpiCardSkeleton } from '../skeletons/KpiCardSkeleton'
import { ChartSkeleton } from '../skeletons/ChartSkeleton'
import { EmptyState } from '../EmptyState'
import { YearSelector } from './YearSelector'
import { CapitalInfoCard } from './CapitalInfoCard'
import { AffiliateBanner } from '../ads/AffiliateBanner'
import { AFFILIATIONS } from '../../constants/affiliations'

// Constants
const REVENUE_THRESHOLD_HIGH = 10_000_000 // 10M NOK

interface FinancialsTabProps {
  company: CompanyWithAccounting
  selectedYear: number | null
  selectedAccountingId: number | null
  onSelectAccounting: (year: number, accountingId: number) => void
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
    const aff = AFFILIATIONS.ZENSUM_LOAN
    return {
      ...aff,
      id: `financials_${aff.id}`,
    }
  }

  // Priority: Official Tjenestetorget affiliation for companies with few accounting records
  if (company.regnskap.length < 2) {
    const aff = AFFILIATIONS.TJENESTETORGET_ACCOUNTANT
    return {
      ...aff,
      id: `financials_${aff.id}`,
    }
  }

  return null
}

export const FinancialsTab = React.memo(function FinancialsTab({
  company,
  selectedYear,
  selectedAccountingId,
  onSelectAccounting,
  kpiData,
  kpiLoading,
  kpiError,
  onRetryKpi,
  onImport,
  isImporting
}: FinancialsTabProps) {

  // Filter accounting records to only show periods with actual financial data
  // No deduplication — show all periods including split fiscal years
  const validAccountings = useMemo(() => {
    return company.regnskap
      .filter(acc =>
        acc.salgsinntekter != null ||
        acc.aarsresultat != null ||
        acc.sum_eiendeler != null
      )
      .sort((a, b) => {
        if (b.aar !== a.aar) return b.aar - a.aar
        const aTil = a.periode_til || ''
        const bTil = b.periode_til || ''
        return aTil.localeCompare(bTil)
      })
  }, [company.regnskap])

  const adConfig = useMemo(() => getAdConfig(company), [company])

  // Auto-select latest period if none selected
  useEffect(() => {
    if (selectedAccountingId === null && validAccountings.length > 0) {
      const latest = validAccountings[0]
      onSelectAccounting(latest.aar, latest.id)
    }
  }, [selectedAccountingId, validAccountings, onSelectAccounting])

  return (
    <div className="space-y-8 animate-fade-in pb-8">
      {/* Premium UX: Subunit Context Note - Always visible for subunits */}
      {company.parent_orgnr && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-100 bg-blue-50/40 p-4 shadow-sm dark:border-blue-400/20 dark:bg-blue-500/10">
          <Info className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900/80 dark:text-blue-100/85">
            <p className="mb-0.5 font-bold text-blue-900 dark:text-blue-100">Underenhet</p>
            <p className="leading-relaxed">
              Dette er en underenhet. Offisielle regnskapstall rapporteres vanligvis konsolidert på hovedenhetens nivå.
              {validAccountings.length > 0 ? ' Spesifikke lokale tall for denne underenheten vises nedenfor.' : ''}
            </p>
            <Link 
              to="/virksomhet/$orgnr" 
              params={{ orgnr: company.parent_orgnr }}
              search={{ tab: 'okonomi' as const }}
              className="mt-2 inline-flex w-fit items-center rounded-md bg-blue-100/50 px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100 hover:text-blue-800 dark:bg-blue-500/15 dark:text-blue-200 dark:hover:bg-blue-500/20"
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
            description="Denne virksomheten har ingen lagrede regnskapsdata. Vil du hente data fra Brønnøysundregistrene?"
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
                logo={adConfig.logo}
                variant={adConfig.variant}
                legalText={adConfig.legalText}
                legalTextMode="inline"
              />
            </div>
          )}

          {/* Year Selector */}
          <section aria-label="Velg regnskapsår">
            <YearSelector
              accountings={validAccountings}
              selectedAccountingId={selectedAccountingId}
              onSelectAccounting={onSelectAccounting}
            />
          </section>

          {/* KPI Dashboard */}
          {selectedAccountingId && (
            <section aria-labelledby="kpi-heading" className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600 shrink-0" aria-hidden="true" />
                  <h2 id="kpi-heading" className="text-xl font-semibold text-gray-900 dark:text-white">
                    Nøkkeltall {selectedYear}
                  </h2>
                </div>
                {company.last_polled_regnskap && (
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    Oppdatert: {formatDate(company.last_polled_regnskap)}
                  </span>
                )}
              </div>

              <div className="min-h-50" aria-live="polite" aria-busy={kpiLoading}>
                {kpiLoading ? (
                  <KpiCardSkeleton />
                ) : kpiError ? (
                  <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-800 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-100">
                    <Database className="h-5 w-5 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Mangler detaljerte nøkkeltall</h4>
                      <p className="text-sm mt-1 opacity-90">
                        Vi fant ikke detaljerte nøkkeltall for {selectedYear}. Dette kan skyldes at året ikke er ferdigstilt eller manglende data fra Brønnøysundregistrene.
                      </p>
                      <button
                        onClick={onRetryKpi}
                        className="mt-2 text-sm font-medium underline hover:text-yellow-900 dark:hover:text-amber-50"
                      >
                        Prøv på nytt
                      </button>
                    </div>
                  </div>
                ) : kpiData ? (
                  <KpiDashboard data={kpiData} />
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-gray-400 dark:border-slate-700 dark:text-slate-500">
                    Laster nøkkeltall...
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Charts */}
          {validAccountings.length > 0 && (
            <section aria-labelledby="charts-heading">
              <h2 id="charts-heading" className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
                Historisk Utvikling
              </h2>
              <div className="min-h-75">
                {kpiLoading ? <ChartSkeleton height={300} /> : <CompanyCharts company={company} />}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
})
