/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, Link } from '@tanstack/react-router'
import { useMunicipalityQuery } from '../hooks/queries/useMunicipalityQuery'
import { SEOHead, Breadcrumbs } from '../components/layout'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loader2, TrendingUp, ChevronRight, Map } from 'lucide-react'
import { formatNumber } from '../utils/formatters'
import { HeroMap } from '../components/maps/HeroMap'
import { createRouteCode } from '../utils/slugify'
import {
  EstablishmentTrendChart,
  TopCompanyList,
  NewestCompaniesList,
  BankruptciesSection,
  SectorDistribution
} from '../components/dashboard'

// The route handles slugified codes like "0301-oslo"
export const Route = createFileRoute('/kommune/$code')({
  component: MunicipalityDashboardPage,
})

export function MunicipalityDashboardPage() {
  const { code: slug } = Route.useParams()

  // Extract the 4-digit code and a safe display name for loading state
  const code = slug.split('-')[0]
  const displayName = slug.split('-').slice(1).join(' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (l: string) => l.toUpperCase()) || 'valgt kommune'

  const {
    data: dashboard,
    isLoading,
    isError,
    refetch
  } = useMunicipalityQuery(code)

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] py-20">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-600 font-medium tracking-tight">Laster lokal innsikt for {displayName}...</p>
      </div>
    )
  }

  if (isError || !dashboard) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <ErrorMessage
          message={`Kunne ikke finne data for kommunen ${code}`}
          onRetry={() => refetch()}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SEOHead
        title={`${dashboard.name} Dashboard - Bedriftsgrafen.no`}
        description={`Lokal innsikt, statistikk og topplister for virksomheter i ${dashboard.name}. Se folketall, vekst og næringslivstrender.`}
        ogImage={`/v1/og/municipality/${dashboard.code}.svg`}
      />


      <main>
        {/* Hero Section */}
        <div className="relative bg-slate-900 text-white pt-12 pb-24 px-4 shadow-2xl mb-12 overflow-hidden min-h-[600px] flex flex-col justify-center border-b border-white/5">
          {/* Background Map with lower opacity for premium feel */}
          {dashboard.lat && dashboard.lng && (
            <div className="opacity-40" aria-hidden="true" role="presentation">
              <HeroMap lat={dashboard.lat} lng={dashboard.lng} />
            </div>
          )}

          <div className="max-w-7xl mx-auto w-full relative z-10 px-4">
            {/* Integrated Breadcrumbs with county link for drill-down navigation */}
            <div className="mb-12">
              <Breadcrumbs
                items={[
                  { label: 'Hjem', to: '/', className: 'text-white/50 hover:text-white' },
                  { label: 'Fylker', to: '/fylker', className: 'text-white/50 hover:text-white' },
                  { label: dashboard.county_name, to: `/fylke/${createRouteCode(dashboard.county_code, dashboard.county_name)}`, className: 'text-white/50 hover:text-white' },
                  { label: dashboard.name, className: 'text-white font-bold' }
                ]}
                variant="transparent"
              />
            </div>

            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-16">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-8">
                  <span className="px-4 py-1.5 bg-blue-500/20 border border-blue-400/30 backdrop-blur-xl rounded-full text-xs font-black tracking-widest uppercase text-blue-200">
                    KODE {dashboard.code}
                  </span>
                  <span className="h-1.5 w-1.5 bg-white/20 rounded-full" aria-hidden="true" />
                  <span className="text-white/70 text-xs font-black tracking-widest uppercase">
                    {dashboard.county_name}
                  </span>
                </div>
                <h1 className="text-7xl md:text-9xl font-black tracking-tighter mb-10 drop-shadow-2xl leading-none">
                  {dashboard.name}
                </h1>
                <p className="text-blue-100/80 text-xl md:text-2xl font-medium max-w-2xl leading-relaxed drop-shadow-md">
                  En strategisk oversikt over næringsliv, demografi og økonomisk utvikling i {dashboard.name} kommune.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-6">
                <div className="bg-white/5 backdrop-blur-3xl rounded-4xl p-10 border border-white/10 shadow-2xl min-w-[240px]">
                  <p className="text-blue-100/70 text-xs font-black uppercase tracking-widest mb-6">INNBYGGERE</p>
                  <div className="flex items-center gap-6">
                    <span className="text-6xl font-black tracking-tighter">{formatNumber(dashboard.population)}</span>
                    {dashboard.population_growth_1y != null && (
                      <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black ${dashboard.population_growth_1y > 0 ? 'bg-emerald-400/10 text-emerald-400 border border-emerald-400/20' : 'bg-rose-400/10 text-rose-400 border border-rose-400/20'}`}>
                        <TrendingUp className={`h-3.5 w-3.5 ${dashboard.population_growth_1y < 0 ? 'rotate-180' : ''}`} />
                        {dashboard.population_growth_1y > 0 ? '+' : ''}{dashboard.population_growth_1y.toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-white/5 backdrop-blur-3xl rounded-4xl p-10 border border-white/10 shadow-2xl min-w-[240px]">
                  <p className="text-blue-100/70 text-xs font-black uppercase tracking-widest mb-6">VIRKSOMHETER</p>
                  <span className="text-6xl font-black tracking-tighter">{formatNumber(dashboard.company_count)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pb-32">
          {/* Trend & Grid layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-16">
            {/* Establishment Trend Chart */}
            <EstablishmentTrendChart data={dashboard.establishment_trend} />

            <section className="bg-slate-900 text-white rounded-[2.5rem] p-12 shadow-2xl flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity">
                <Map className="h-48 w-48 rotate-12" />
              </div>
              <div className="relative z-10">
                <h2 className="text-3xl font-black mb-6 tracking-tight">Næringsstyrke</h2>
                <p className="text-blue-100/70 text-xl font-medium mb-10 leading-relaxed">
                  Virksomhetstettheten er <strong className="text-white text-3xl font-black block mt-2">{dashboard.business_density?.toFixed(1) ?? '0.0'}</strong> virksomheter per 1000 innbyggere.
                </p>
                <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/10 text-blue-100/60 text-sm leading-relaxed font-medium">
                  Landssnittet ligger på {dashboard.business_density_national_avg?.toFixed(1) ?? '0.0'}.
                </div>
              </div>
              <div className="mt-12 relative z-10">
                <Link
                  to="/kart"
                  search={{ municipality_code: dashboard.code }}
                  className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-blue-500 transition-all shadow-xl shadow-blue-900/20"
                >
                  Utforsk i kartet
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </section>

            {/* Sector Distribution */}
            <SectorDistribution sectors={dashboard.top_sectors} />

            {/* Ranking Card */}
            <section className="bg-white rounded-[2.5rem] p-12 border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div>
                <h2 className="text-3xl font-black text-slate-900 mb-10 tracking-tight font-display text-center">Lokal Ranking</h2>

                <div className="flex flex-col gap-6">
                  <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 flex items-center justify-between group-hover:bg-blue-50/50 transition-colors">
                    <div>
                      <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">TETTHET</p>
                      <p className="text-slate-600 text-xs font-bold">i {dashboard.county_name}</p>
                    </div>
                    <div className="text-5xl font-black text-slate-900 tracking-tighter">
                      <span className="text-blue-600 text-2xl tracking-normal mr-1" aria-hidden="true">#</span>{dashboard.ranking_in_county_density?.rank ?? '—'}
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 flex items-center justify-between group-hover:bg-emerald-50/50 transition-colors">
                    <div>
                      <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">OMSETNING</p>
                      <p className="text-slate-600 text-xs font-bold">i {dashboard.county_name}</p>
                    </div>
                    <div className="text-5xl font-black text-slate-900 tracking-tighter">
                      <span className="text-emerald-600 text-2xl tracking-normal mr-1" aria-hidden="true">#</span>{dashboard.ranking_in_county_revenue?.rank ?? '—'}
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 flex items-center justify-between group-hover:bg-indigo-50/50 transition-colors">
                    <div>
                      <p className="text-slate-500 text-xs font-black uppercase tracking-widest mb-1">INNBYGGERE</p>
                      <p className="text-slate-600 text-xs font-bold">i {dashboard.county_name}</p>
                    </div>
                    <div className="text-5xl font-black text-slate-900 tracking-tighter">
                      <span className="text-indigo-600 text-2xl tracking-normal mr-1" aria-hidden="true">#</span>{dashboard.ranking_in_county_population?.rank ?? '—'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-10 text-xs text-slate-500 font-bold p-6 bg-slate-50 rounded-3xl border border-slate-100 leading-relaxed text-center italic">
                {dashboard.name} er rangert av {dashboard.ranking_in_county_density?.out_of ?? '—'} kommuner.
              </div>
            </section>
          </div>

          {/* Company Lists - Higher density professional look */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <TopCompanyList companies={dashboard.top_companies} />
            <NewestCompaniesList
              companies={dashboard.newest_companies}
              regionName={dashboard.name}
              regionCode={dashboard.code}
              regionType="municipality"
            />
          </div>

          {/* Bankruptcies section - Premium professional look */}
          <BankruptciesSection
            companies={dashboard.latest_bankruptcies}
            regionName={dashboard.name}
            regionCode={dashboard.code}
            regionType="municipality"
          />
        </div>
      </main>
    </div>
  )
}