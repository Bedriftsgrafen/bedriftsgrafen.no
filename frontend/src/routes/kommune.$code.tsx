import { createFileRoute, Link } from '@tanstack/react-router'
import { useMunicipalityQuery } from '../hooks/queries/useMunicipalityQuery'
import { SEOHead, Breadcrumbs } from '../components/layout'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loader2, MapPin, Building2, TrendingUp, ChevronRight, Sparkles, Map } from 'lucide-react'
import { formatNumber, formatLargeCurrency } from '../utils/formatters'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { HeroMap } from '../components/maps/HeroMap'

// The route handles slugified codes like "0301-oslo"
export const Route = createFileRoute('/kommune/$code')({
  component: MunicipalityDashboardPage,
})

function MunicipalityDashboardPage() {
  const { code: slug } = Route.useParams()

  // Extract the 4-digit code if it's a slug (e.g. "0301-oslo" -> "0301")
  // Extract the 4-digit code and a safe display name for loading state
  const code = slug.split('-')[0]
  const displayName = slug.split('-').slice(1).join(' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, l => l.toUpperCase()) || 'valgt kommune'

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
        <div className="relative bg-slate-900 text-white pt-6 pb-16 px-4 shadow-xl mb-12 overflow-hidden min-h-[500px] flex flex-col justify-center border-b border-white/5">
          {/* Background Map */}
          {dashboard.lat && dashboard.lng && (
            <HeroMap lat={dashboard.lat} lng={dashboard.lng} />
          )}

          <div className="max-w-7xl mx-auto w-full relative z-10 px-4">
            {/* Integrated Breadcrumbs - brighter text for visibility */}
            <div className="mb-8 -ml-4">
              <Breadcrumbs
                items={[
                  { label: 'Hjem', to: '/', className: 'text-white/70 hover:text-white' },
                  { label: 'Kommuner', to: '/kommuner', className: 'text-white/70 hover:text-white' },
                  { label: dashboard.name, className: 'text-white font-semibold' }
                ]}
                variant="transparent"
              />
            </div>

            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-8">
                  <span className="px-3 py-1 bg-blue-500/30 border border-blue-400/30 backdrop-blur-md rounded-full text-[10px] font-black tracking-widest uppercase">
                    KOMMUNENUMMER {dashboard.code}
                  </span>
                  <span className="h-1 w-1 bg-white/30 rounded-full" />
                  <span className="text-blue-300 text-[10px] font-black tracking-widest uppercase">
                    {dashboard.county_name}
                  </span>
                </div>
                <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 drop-shadow-2xl">
                  {dashboard.name}
                </h1>
                <p className="text-blue-100/90 text-xl md:text-2xl font-medium max-w-3xl leading-relaxed drop-shadow-md">
                  Basert på offisielle data fra Enhetsregisteret og SSB, viser vi her en oversikt over næringslivets struktur, folketall og vekst for å gi innsikt i lokal verdiskaping.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="bg-white/10 backdrop-blur-2xl rounded-3xl p-8 border border-white/20 shadow-2xl min-w-[200px]">
                  <p className="text-blue-200/60 text-[10px] font-black uppercase tracking-widest mb-4">INNBYGGERE</p>
                  <div className="flex items-center gap-4">
                    <span className="text-5xl font-black tracking-tight">{formatNumber(dashboard.population)}</span>
                    {dashboard.population_growth_1y != null && (
                      <div className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-black ${dashboard.population_growth_1y > 0 ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30' : 'bg-rose-400/20 text-rose-300 border border-rose-400/30'}`}>
                        <TrendingUp className={`h-3 w-3 ${dashboard.population_growth_1y < 0 ? 'rotate-180' : ''}`} />
                        {dashboard.population_growth_1y > 0 ? '+' : ''}{dashboard.population_growth_1y.toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-2xl rounded-3xl p-8 border border-white/20 shadow-2xl min-w-[200px]">
                  <p className="text-blue-200/60 text-[10px] font-black uppercase tracking-widest mb-4">VIRKSOMHETER</p>
                  <span className="text-5xl font-black tracking-tight">{formatNumber(dashboard.company_count)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 pb-20">
          {/* Trend & Grid layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
            {/* Establishment Trend Chart */}
            <section className="lg:col-span-2 bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative overflow-hidden group">
              <h2 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3">
                <div className="h-8 w-1.5 bg-blue-600 rounded-full" />
                Nyetableringer Per Måned
              </h2>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboard.establishment_trend}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#2563eb"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorValue)"
                      activeDot={{ r: 6, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900 mb-4">Næringsstyrke</h2>
                <p className="text-slate-600 text-xl font-bold mb-6 leading-relaxed">
                  Virksomhetstettheten i {dashboard.name} er <strong className="text-blue-600">{dashboard.business_density?.toFixed(1) ?? '0.0'}</strong> per 1000 innbyggere.
                </p>
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 italic text-slate-500 text-sm leading-relaxed">
                  Landssnittet er {dashboard.business_density_national_avg?.toFixed(1) ?? '0.0'}. En høyere tetthet indikerer et mer aktivt lokalt næringsliv.
                </div>
              </div>
              <div className="mt-8">
                <Link
                  to="/kart"
                  search={{ municipality_code: dashboard.code }}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg"
                >
                  <Map className="h-4 w-4" />
                  Se i kart
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </section>

            {/* Sector Distribution */}
            <section className="lg:col-span-2 bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity text-slate-300">
                <Building2 className="h-32 w-32" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-8 flex items-center gap-3">
                <div className="h-8 w-1.5 bg-blue-600 rounded-full" />
                Største Bransjer
              </h2>
              <div className="space-y-6">
                {dashboard.top_sectors.map(sector => (
                  <div key={sector.nace_division} className="relative">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-slate-700 font-bold text-sm uppercase tracking-tight truncate max-w-[80%]">
                        {sector.nace_name}
                      </span>
                      <span className="text-slate-900 font-black tabular-nums text-sm">
                        {sector.percentage_of_total?.toFixed(1) ?? '0.0'}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner">
                      <div
                        className="bg-linear-to-r from-blue-600 to-blue-500 h-full rounded-full transition-all duration-1000 ease-out shadow-sm"
                        style={{ width: `${sector.percentage_of_total}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Ranking Card */}
            <section className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity text-blue-600">
                <TrendingUp className="h-32 w-32" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 mb-6 font-display">Lokal Ranking</h2>

                <div className="flex flex-col gap-4">
                  <div className="bg-slate-50 rounded-2xl p-6 text-center border border-slate-100 shadow-inner flex items-center justify-between">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">TETTHET</p>
                    <div className="flex flex-col items-end">
                      <div className="text-4xl font-black text-slate-900 tracking-tighter">
                        <span className="text-blue-600 text-xl">#</span>{dashboard.ranking_in_county_density?.rank ?? '—'}
                      </div>
                      <p className="text-slate-500 text-[10px] font-bold">av {dashboard.ranking_in_county_density?.out_of ?? '—'} i fylket</p>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-2xl p-6 text-center border border-slate-100 shadow-inner hover:border-blue-200 transition-colors cursor-default flex items-center justify-between">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">OMSETNING</p>
                    <div className="flex flex-col items-end">
                      <div className="text-4xl font-black text-slate-900 tracking-tighter">
                        <span className="text-emerald-600 text-xl">#</span>{dashboard.ranking_in_county_revenue?.rank ?? '—'}
                      </div>
                      <p className="text-slate-500 text-[10px] font-bold">av {dashboard.ranking_in_county_revenue?.out_of ?? '—'} i fylket</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 text-xs text-slate-500 font-medium p-5 bg-blue-50/50 rounded-2xl border border-blue-100/50 leading-relaxed">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                  <p>Virksomheter i <strong>{dashboard.name}</strong> står for en betydelig del av fylkets verdiskaping.</p>
                </div>
              </div>
            </section>
          </div>

          {/* Company Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <section className="bg-white rounded-4xl p-10 border border-slate-200 shadow-sm">
              <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  Størst i {dashboard.name}
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">TOPP 5</span>
              </h3>
              <div className="space-y-3">
                {dashboard.top_companies.map((company, idx) => (
                  <Link
                    key={company.orgnr}
                    to="/bedrift/$orgnr"
                    params={{ orgnr: company.orgnr }}
                    className="flex items-center justify-between p-4 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-md rounded-2xl transition-all group"
                  >
                    <div className="flex items-center gap-5 min-w-0">
                      <span className="text-slate-300 font-black text-xl tabular-nums w-6">{(idx + 1)}</span>
                      <div className="truncate">
                        <p className="text-slate-900 font-bold group-hover:text-blue-600 transition-colors truncate text-sm">
                          {company.navn}
                        </p>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-tight mt-0.5">
                          {company.organisasjonsform} • {company.orgnr}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {company.latest_revenue && (
                        <div className="flex flex-col items-end">
                          <p className="text-slate-900 font-black tabular-nums text-sm">
                            {formatLargeCurrency(company.latest_revenue)}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">OMSETNING</p>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-4xl p-10 border border-slate-200 shadow-sm">
              <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  Nyetablerte
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">SISTE</span>
              </h3>
              <div className="space-y-3">
                {dashboard.newest_companies.map(company => (
                  <Link
                    key={company.orgnr}
                    to="/bedrift/$orgnr"
                    params={{ orgnr: company.orgnr }}
                    className="flex items-center justify-between p-4 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-md rounded-2xl transition-all group"
                  >
                    <div className="flex items-center gap-5 min-w-0">
                      <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black text-xs group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div className="truncate">
                        <p className="text-slate-900 font-bold group-hover:text-blue-600 transition-colors truncate text-sm">
                          {company.navn}
                        </p>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-tight mt-0.5">
                          Stiftet {company.stiftelsesdato}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </Link>
                ))}

                <Link
                  to="/nyetableringer"
                  search={{ municipality_code: dashboard.code }}
                  className="flex items-center justify-center gap-2 p-4 text-blue-600 font-bold text-sm tracking-tight hover:underline transition-all mt-4"
                >
                  Se alle nyetableringer i {dashboard.name}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </section>

            <section className="bg-white rounded-4xl p-10 border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5 text-rose-600">
                <TrendingUp className="h-32 w-32 rotate-180" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 rotate-180" />
                  </div>
                  Siste Konkurser
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MELDINGER</span>
              </h3>
              <div className="space-y-3">
                {dashboard.latest_bankruptcies.length > 0 ? (
                  dashboard.latest_bankruptcies.map(company => (
                    <Link
                      key={company.orgnr}
                      to="/bedrift/$orgnr"
                      params={{ orgnr: company.orgnr }}
                      className="flex items-center justify-between p-4 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 hover:shadow-md rounded-2xl transition-all group"
                    >
                      <div className="flex items-center gap-5 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-black text-xs group-hover:bg-rose-600 group-hover:text-white transition-colors">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div className="truncate">
                          <p className="text-slate-900 font-bold group-hover:text-rose-600 transition-colors truncate text-sm">
                            {company.navn}
                          </p>
                          <p className="text-rose-600/60 text-[10px] font-black uppercase tracking-tight mt-0.5">
                            Konkurs {company.konkursdato || 'nylig'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-rose-600 group-hover:translate-x-1 transition-all" />
                    </Link>
                  ))
                ) : (
                  <div className="bg-slate-50 rounded-2xl p-8 text-center border border-slate-100">
                    <p className="text-slate-400 text-sm font-medium">Ingen nylige konkurser registrert i denne kommunen.</p>
                  </div>
                )}

                <Link
                  to="/konkurser"
                  search={{ municipality_code: dashboard.code }}
                  className="flex items-center justify-center gap-2 p-4 text-slate-600 font-bold text-sm tracking-tight hover:underline transition-all mt-4"
                >
                  Se alle konkurser i {dashboard.name}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
