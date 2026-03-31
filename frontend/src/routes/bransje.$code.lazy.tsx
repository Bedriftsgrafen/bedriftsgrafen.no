/* eslint-disable react-refresh/only-export-components */
import { createLazyFileRoute, Link } from '@tanstack/react-router'
import { useIndustryDashboardQuery } from '../hooks/queries/useIndustryDashboardQuery'
import { SEOHead, Breadcrumbs } from '../components/layout'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loader2, ChevronRight, Factory, BarChart3 } from 'lucide-react'
import { formatNumber, formatCurrency } from '../utils/formatters'
import { createRouteCode } from '../utils/slugify'
import {
  TrendChart,
  EstablishmentTrendChart,
  TopCompanyList,
  NewestCompaniesList,
  BankruptciesSection,
} from '../components/dashboard'

export const Route = createLazyFileRoute('/bransje/$code')({
  component: IndustryDashboardPage,
})

export function IndustryDashboardPage() {
  const { code: slug } = Route.useParams()
  const code = slug.split('-')[0]
  const displayName =
    slug
      .split('-')
      .slice(1)
      .join(' ')
      .toLowerCase()
      .replace(/(^|\s)\S/g, (l: string) => l.toUpperCase()) || 'valgt bransje'

  const { data: dashboard, isLoading, isError, refetch } = useIndustryDashboardQuery(code)

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] py-20">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-600 font-medium tracking-tight">
          Laster bransjeinnsikt for {displayName}...
        </p>
      </div>
    )
  }

  if (isError || !dashboard) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <ErrorMessage
          message={`Kunne ikke finne data for ${displayName}`}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  const profitablePercent =
    dashboard.profitable_count != null && dashboard.company_count > 0
      ? Math.round((dashboard.profitable_count / dashboard.company_count) * 100)
      : null

  return (
    <div className="min-h-screen bg-slate-50">
      <SEOHead
        title={`${dashboard.nace_name ?? `NACE ${dashboard.nace_division}`} - Bransjeoversikt | Bedriftsgrafen.no`}
        description={`Bransjeinnsikt for ${dashboard.nace_name ?? dashboard.nace_division}. ${formatNumber(dashboard.company_count)} virksomheter, ${formatNumber(dashboard.total_employees ?? 0)} ansatte. Se trender, topplister og underbransjer.`}
      />

      <main>
        {/* Hero Section */}
        <div className="relative bg-slate-900 text-white pt-12 pb-24 px-4 shadow-2xl mb-12 overflow-hidden min-h-[500px] flex flex-col justify-center border-b border-white/5">
          <div className="absolute top-0 right-0 p-16 opacity-[0.03]" aria-hidden="true">
            <Factory className="h-96 w-96 rotate-12" />
          </div>

          <div className="max-w-7xl mx-auto w-full relative z-10 px-4">
            <div className="mb-12">
              <Breadcrumbs
                items={[
                  { label: 'Hjem', to: '/', className: 'text-white/50 hover:text-white' },
                  { label: 'Bransjer', to: '/bransjer', className: 'text-white/50 hover:text-white' },
                  { label: dashboard.nace_name ?? dashboard.nace_division, className: 'text-white font-bold' },
                ]}
                variant="transparent"
              />
            </div>

            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-16">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-8">
                  <span className="px-4 py-1.5 bg-blue-500/20 border border-blue-400/30 backdrop-blur-xl rounded-full text-xs font-black tracking-widest uppercase text-blue-200">
                    NACE {dashboard.nace_division}
                  </span>
                  {dashboard.nace_section && (
                    <>
                      <span className="h-1.5 w-1.5 bg-white/20 rounded-full" aria-hidden="true" />
                      <span className="text-white/70 text-xs font-black tracking-widest uppercase">
                        Seksjon {dashboard.nace_section}
                      </span>
                    </>
                  )}
                </div>
                <h1 className="text-5xl md:text-8xl font-black tracking-tighter mb-10 drop-shadow-2xl leading-none">
                  {dashboard.nace_name ?? `Bransje ${dashboard.nace_division}`}
                </h1>
                {dashboard.nace_section_name && (
                  <p className="text-blue-100/80 text-xl md:text-2xl font-medium max-w-2xl leading-relaxed drop-shadow-md">
                    Del av «{dashboard.nace_section_name}». Statistikk og innsikt for hele bransjen.
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-6">
                <div className="bg-white/5 backdrop-blur-3xl rounded-4xl p-10 border border-white/10 shadow-2xl min-w-[220px]">
                  <p className="text-blue-100/70 text-xs font-black uppercase tracking-widest mb-6">
                    VIRKSOMHETER
                  </p>
                  <span className="text-5xl font-black tracking-tighter">
                    {formatNumber(dashboard.company_count)}
                  </span>
                </div>
                <div className="bg-white/5 backdrop-blur-3xl rounded-4xl p-10 border border-white/10 shadow-2xl min-w-[220px]">
                  <p className="text-blue-100/70 text-xs font-black uppercase tracking-widest mb-6">ANSATTE</p>
                  <span className="text-5xl font-black tracking-tighter">
                    {formatNumber(dashboard.total_employees ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pb-32">
          {/* Key metrics cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
            <MetricCard label="Nye siste år" value={formatNumber(dashboard.new_last_year)} />
            <MetricCard label="Konkurser siste år" value={formatNumber(dashboard.bankruptcies_last_year)} />
            <MetricCard label="Gj.sn. omsetning" value={dashboard.avg_revenue ? formatCurrency(dashboard.avg_revenue) : '—'} />
            <MetricCard
              label="Lønnsomme"
              value={profitablePercent != null ? `${profitablePercent}%` : '—'}
            />
          </div>

          {/* Trends Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mb-10">
            <EstablishmentTrendChart data={dashboard.establishment_trend} />
            <TrendChart
              data={dashboard.bankrupt_trend}
              title="Konkurser"
              color="#ef4444"
              gradientId="colorBankruptciesIndustry"
            />
          </div>

          {/* Core Metrics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-16">
            {/* Financial Overview */}
            <section className="bg-slate-900 text-white rounded-[2.5rem] p-12 shadow-2xl flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity">
                <BarChart3 className="h-48 w-48 rotate-12" />
              </div>
              <div className="relative z-10">
                <h2 className="text-3xl font-black mb-6 tracking-tight">Bransjeøkonomi</h2>
                <div className="space-y-6 text-blue-100/70 text-lg font-medium leading-relaxed">
                  <p>
                    Total omsetning:{' '}
                    <strong className="text-white text-2xl font-black block mt-1">
                      {dashboard.total_revenue ? formatCurrency(dashboard.total_revenue) : '—'}
                    </strong>
                  </p>
                  <p>
                    Gj.sn. driftsmargin:{' '}
                    <strong className="text-white text-2xl font-black block mt-1">
                      {dashboard.avg_operating_margin != null
                        ? `${dashboard.avg_operating_margin.toFixed(1)}%`
                        : '—'}
                    </strong>
                  </p>
                </div>
              </div>
              <div className="mt-12 relative z-10">
                <Link
                  to="/bransjer"
                  search={{ tab: 'search', nace: dashboard.nace_division }}
                  className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/20"
                >
                  Utforsk virksomheter
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </section>

            {/* Geographic Distribution */}
            {dashboard.top_counties.length > 0 && (
              <section className="bg-white rounded-[2.5rem] p-12 border border-slate-100 shadow-sm">
                <h2 className="text-3xl font-black text-slate-900 mb-10 tracking-tight">
                  Fylkesfordeling
                </h2>
                <div className="space-y-3">
                  {dashboard.top_counties.slice(0, 8).map((county) => (
                    <Link
                      key={county.nace_division}
                      to="/fylke/$code"
                      params={{ code: createRouteCode(county.nace_division, county.nace_name) }}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-blue-50/50 hover:border-blue-200 transition-colors"
                    >
                      <span className="text-sm font-bold text-slate-700 truncate">{county.nace_name}</span>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-black text-slate-900">
                          {formatNumber(county.company_count)}
                        </span>
                        {county.percentage_of_total != null && (
                          <span className="text-xs text-slate-500 font-bold">
                            {county.percentage_of_total.toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Industry Ranking Card */}
            <section className="bg-white rounded-[2.5rem] p-12 border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div>
                <h2 className="text-3xl font-black text-slate-900 mb-10 tracking-tight text-center">
                  Bransjeranking
                </h2>
                <div className="flex flex-col gap-6">
                  <RankingRow
                    label="OMSETNING"
                    sublabel="blant alle bransjer"
                    rank={dashboard.ranking_by_revenue?.rank}
                    accentColor="text-blue-600"
                    hoverBg="group-hover:bg-blue-50/50"
                  />
                  <RankingRow
                    label="VIRKSOMHETER"
                    sublabel="blant alle bransjer"
                    rank={dashboard.ranking_by_companies?.rank}
                    accentColor="text-emerald-600"
                    hoverBg="group-hover:bg-emerald-50/50"
                  />
                  <RankingRow
                    label="ANSATTE"
                    sublabel="blant alle bransjer"
                    rank={dashboard.ranking_by_employees?.rank}
                    accentColor="text-indigo-600"
                    hoverBg="group-hover:bg-indigo-50/50"
                  />
                </div>
              </div>
              <div className="mt-10 text-xs text-slate-500 font-bold p-6 bg-slate-50 rounded-3xl border border-slate-100 leading-relaxed text-center italic">
                Rangert blant {dashboard.ranking_by_revenue?.out_of ?? '—'} bransjer i Norge.
              </div>
            </section>
          </div>

          {/* Subclass Breakdown */}
          {dashboard.subclasses.length > 0 && (
            <section className="bg-white rounded-[2.5rem] p-12 border border-slate-100 shadow-sm mb-16">
              <h2 className="text-3xl font-black text-slate-900 mb-12 flex items-center gap-4 tracking-tight">
                <div className="h-10 w-2 bg-blue-600 rounded-full" />
                Underbransjer
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dashboard.subclasses.map((sc) => (
                  <div
                    key={sc.nace_code}
                    className="p-5 bg-slate-50 border border-slate-100 rounded-2xl"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-black rounded-lg">
                        {sc.nace_code}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-slate-800 mb-2">{sc.nace_name ?? sc.nace_code}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-500 font-medium">
                      <span>{formatNumber(sc.company_count)} virksomheter</span>
                      {sc.total_employees != null && (
                        <span>{formatNumber(sc.total_employees)} ansatte</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Company Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <TopCompanyList companies={dashboard.top_companies} />
            <NewestCompaniesList
              companies={dashboard.newest_companies}
              regionName={dashboard.nace_name ?? dashboard.nace_division}
              regionCode={dashboard.nace_division}
              regionType="industry"
            />
          </div>

          {/* Bankruptcies section */}
          <BankruptciesSection
            companies={dashboard.latest_bankruptcies}
            regionName={dashboard.nace_name ?? dashboard.nace_division}
            regionCode={dashboard.nace_division}
            regionType="industry"
          />
        </div>
      </main>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
      <p className="text-xs text-slate-500 font-black uppercase tracking-widest mb-2">{label}</p>
      <p className="text-2xl font-black text-slate-900 tracking-tight">{value}</p>
    </div>
  )
}

function RankingRow({
  label,
  sublabel,
  rank,
  accentColor,
  hoverBg,
}: {
  label: string
  sublabel: string
  rank?: number
  accentColor: string
  hoverBg: string
}) {
  return (
    <div
      className={`rounded-3xl p-8 border border-slate-100 flex items-center justify-between transition-colors bg-slate-50 ${hoverBg}`}
    >
      <div>
        <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">{label}</p>
        <p className="text-slate-600 text-xs font-bold">{sublabel}</p>
      </div>
      <div className="text-5xl font-black text-slate-900 tracking-tighter">
        <span className={`text-2xl tracking-normal mr-1 ${accentColor}`} aria-hidden="true">
          #
        </span>
        {rank ?? '—'}
      </div>
    </div>
  )
}
