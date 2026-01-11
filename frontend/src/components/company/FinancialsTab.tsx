import React, { useMemo, useEffect } from 'react'
import { TrendingUp, Database, Calculator, Wallet } from 'lucide-react'
import type { CompanyWithAccounting, AccountingWithKpis } from '../../types'
import { formatDate } from '../../utils/formatters'
import { deduplicateAccountingsByYear } from '../../utils/accountingHelpers'
import { KpiDashboard } from '../KpiDashboard'
import { CompanyCharts } from '../CompanyCharts'
import { KpiCardSkeleton } from '../skeletons/KpiCardSkeleton'
import { ChartSkeleton } from '../skeletons/ChartSkeleton'
import { EmptyState } from '../EmptyState'
import { YearSelector } from './YearSelector'
import { AffiliateBanner } from '../ads/AffiliateBanner'
import { CONTACT_EMAIL } from '../../constants/contact'

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
      desc: `Nå ut til bedrifter med høy omsetning.Denne plassen er ledig for samarbeid.Kontakt oss på ${CONTACT_EMAIL}.`,
      btn: "Send e-post",
      icon: Wallet,
      variant: "banking" as const
    }
  }

  if (company.regnskap.length < 2) {
    return {
      id: "accounting_financials",
      title: "Synliggjør din bedrift her?",
      desc: "Nå ut til beslutningstakere i norske bedrifter. Kontakt oss for annonsering og samarbeid.",
      btn: "Ta kontakt",
      icon: Calculator,
      variant: "accounting" as const
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
  // AND deduplicate by year (prefer highest revenue) to avoid UI glitches
  const validAccountings = useMemo(() => {
    const rawFiltered = company.regnskap.filter(acc =>
      acc.salgsinntekter != null ||
      acc.aarsresultat != null ||
      acc.sum_eiendeler != null
    )

    // Use shared deduplication utility
    const deduplicated = deduplicateAccountingsByYear(rawFiltered)

    // Sort descending for display
    return deduplicated.sort((a, b) => b.aar - a.aar)
  }, [company.regnskap])

  const adConfig = useMemo(() => getAdConfig(company), [company])

  // Auto-select latest year if none selected
  useEffect(() => {
    if (selectedYear === null && validAccountings.length > 0) {
      // validAccountings is sorted descending, so [0] is latest
      onSelectYear(validAccountings[0].aar)
    }
  }, [selectedYear, validAccountings, onSelectYear])

  // No accounting data - show import option
  if (validAccountings.length === 0) {
    return (
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
    )
  }

  return (
    <div className="space-y-8 animate-fade-in pb-8">
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
              <h3 id="kpi-heading" className="text-xl font-semibold text-gray-900">
                Nøkkeltall {selectedYear}
              </h3>
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
              // Show skeleton if we have a selected year but no data yet (likely loading)
              // Or if data is truly missing, EmptyState might be better, but kpiData is usually fetched if year exists.
              // Assuming null kpiData with !loading !error means fetching hasn't started or returned nothing.
              // Given auto-select effect, this state should be transient.
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
          <h3 id="charts-heading" className="text-xl font-semibold text-gray-900 mb-4">
            Historisk Utvikling
          </h3>
          {/* Removed fixed h-[300px] to allow content to grow naturally */}
          <div className="min-h-[300px]">
            {kpiLoading ? <ChartSkeleton height={300} /> : <CompanyCharts company={company} />}
          </div>
        </section>
      )}

      {/* Smart Affiliate Targeting */}
      {adConfig && (
        <div className="mt-8 border-t pt-8">
          <AffiliateBanner
            bannerId={adConfig.id}
            placement="financials_tab"
            title={adConfig.title}
            description={adConfig.desc}
            buttonText={adConfig.btn}
            link={`mailto:${CONTACT_EMAIL} `}
            icon={adConfig.icon}
            variant={adConfig.variant}
            isPlaceholder
          />
        </div>
      )}
    </div>
  )
})

