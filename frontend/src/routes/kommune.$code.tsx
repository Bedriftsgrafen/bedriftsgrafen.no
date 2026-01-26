import { createFileRoute, Link } from '@tanstack/react-router'
import { useMunicipalityQuery } from '../hooks/queries/useMunicipalityQuery'
import { SEOHead, Breadcrumbs } from '../components/layout'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loader2, MapPin, TrendingUp, ChevronRight, Map } from 'lucide-react'
import { formatNumber, formatLargeCurrency } from '../utils/formatters'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { HeroMap } from '../components/maps/HeroMap'

// The route handles slugified codes like "0301-oslo"
export const Route = createFileRoute('/kommune/$code')({
  component: MunicipalityDashboardPage,
})

function MunicipalityDashboardPage() {
  const { code: slug } = Route.useParams()

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
        <div className="relative bg-slate-900 text-white pt-12 pb-24 px-4 shadow-2xl mb-12 overflow-hidden min-h-[600px] flex flex-col justify-center border-b border-white/5">
          {/* Background Map with lower opacity for premium feel */}
          {dashboard.lat && dashboard.lng && (
            <div className="opacity-40" aria-hidden="true" role="presentation">
              <HeroMap lat={dashboard.lat} lng={dashboard.lng} />
            </div>
          )}

          <div className="max-w-7xl mx-auto w-full relative z-10 px-4">
            {/* Integrated Breadcrumbs */}
            <div className="mb-12">
              <Breadcrumbs
                items={[
                  { label: 'Hjem', to: '/', className: 'text-white/50 hover:text-white' },
                  { label: 'Kommuner', to: '/kommuner', className: 'text-white/50 hover:text-white' },
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
                <div className="bg-white/5 backdrop-blur-3xl rounded-[2rem] p-10 border border-white/10 shadow-2xl min-w-[240px]">
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
                <div className="bg-white/5 backdrop-blur-3xl rounded-[2rem] p-10 border border-white/10 shadow-2xl min-w-[240px]">
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
            <section className="lg:col-span-2 bg-white rounded-[2.5rem] p-12 border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between mb-12">
                <h2 className="text-3xl font-black text-slate-900 flex items-center gap-4 tracking-tight">
                  <div className="h-10 w-2 bg-blue-600 rounded-full" />
                  Nyetableringer
                </h2>
                <div className="text-xs font-black text-slate-500 uppercase tracking-widest">SISTE 12 MÅNEDER</div>
              </div>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dashboard.establishment_trend}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                      dy={15}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: '1.5rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#2563eb"
                      strokeWidth={4}
                      fillOpacity={1}
                      fill="url(#colorValue)"
                      activeDot={{ r: 8, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="bg-slate-900 text-white rounded-[2.5rem] p-12 shadow-2xl flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity">
                <Map className="h-48 w-48 rotate-12" />
              </div>
              <div className="relative z-10">
                <h2 className="text-3xl font-black mb-6 tracking-tight">Næringsstyrke</h2>
                <p className="text-blue-100/70 text-xl font-medium mb-10 leading-relaxed">
                  Virksomhetstettheten er <strong className="text-white text-3xl font-black block mt-2">{dashboard.business_density?.toFixed(1) ?? '0.0'}</strong> selskaper per 1000 innbyggere.
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
            <section className="lg:col-span-2 bg-white rounded-[2.5rem] p-12 border border-slate-100 shadow-sm relative overflow-hidden group">
              <h2 className="text-3xl font-black text-slate-900 mb-12 flex items-center gap-4 tracking-tight">
                <div className="h-10 w-2 bg-blue-600 rounded-full" />
                Største Bransjer
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                {dashboard.top_sectors.map(sector => (
                  <div key={sector.nace_division} className="relative">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-slate-600 font-black text-xs uppercase tracking-widest truncate max-w-[80%]">
                        {sector.nace_name}
                      </span>
                      <span className="text-slate-900 font-black tabular-nums text-sm">
                        {sector.percentage_of_total?.toFixed(1) ?? '0.0'}%
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-full rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${sector.percentage_of_total}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

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
            <section>
              <h3 className="text-2xl font-black text-slate-900 mb-10 flex items-center justify-between px-2">
                <div className="flex items-center gap-4">
                  Største Selskaper
                </div>
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">ETTER OMSETNING</span>
              </h3>
              <div className="space-y-4">
                {dashboard.top_companies.map((company, idx) => (
                  <Link
                    key={company.orgnr}
                    to="/bedrift/$orgnr"
                    params={{ orgnr: company.orgnr }}
                    className="flex items-center justify-between p-6 bg-white hover:bg-slate-50 border border-slate-100 hover:border-blue-200 rounded-3xl transition-all group shadow-sm focus-visible:ring-2 focus-visible:ring-blue-600 outline-none hover:scale-[1.01]"
                    aria-label={`Se detaljer for ${company.navn}`}
                  >
                    <div className="flex items-center gap-8 min-w-0">
                      <span className="text-slate-200 font-black text-3xl tabular-nums w-12 group-hover:text-blue-100">{(idx + 1).toString().padStart(2, '0')}</span>
                      <div className="truncate">
                        <p className="text-slate-900 font-bold group-hover:text-blue-600 transition-colors truncate text-base tracking-tight">
                          {company.navn}
                        </p>
                        <p className="text-slate-500 text-xs font-black uppercase tracking-widest mt-1">
                          {company.organisasjonsform} • {company.orgnr}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {company.latest_revenue && (
                        <div className="flex flex-col items-end">
                          <p className="text-slate-900 font-black tabular-nums text-base">
                            {formatLargeCurrency(company.latest_revenue)}
                          </p>
                          <p className="text-xs font-black text-slate-500 uppercase tracking-tighter mt-1">OMSETNING</p>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-2xl font-black text-slate-900 mb-10 flex items-center justify-between px-2">
                <div className="flex items-center gap-4">
                  Siste Nyetableringer
                </div>
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">ETTER DATO</span>
              </h3>
              <div className="space-y-4">
                {dashboard.newest_companies.map(company => (
                  <Link
                    key={company.orgnr}
                    to="/bedrift/$orgnr"
                    params={{ orgnr: company.orgnr }}
                    className="flex items-center justify-between p-6 bg-white hover:bg-slate-50 border border-slate-100 hover:border-blue-200 rounded-3xl transition-all group shadow-sm focus-visible:ring-2 focus-visible:ring-blue-600 outline-none hover:scale-[1.01]"
                    aria-label={`Se detaljer for ${company.navn}`}
                  >
                    <div className="flex items-center gap-8 min-w-0">
                      <div className="h-12 w-12 rounded-2xl bg-slate-50 border border-slate-100 text-slate-400 flex items-center justify-center font-black text-xs group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500 transition-all">
                        <MapPin className="h-5 w-5" aria-hidden="true" />
                      </div>
                      <div className="truncate">
                        <p className="text-slate-900 font-bold group-hover:text-blue-600 transition-colors truncate text-base tracking-tight">
                          {company.navn}
                        </p>
                        <p className="text-slate-500 text-xs font-black uppercase tracking-widest mt-1">
                          Stiftet {new Date(company.stiftelsesdato || '').toLocaleDateString('no-NO', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-6 w-6 text-slate-200 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                  </Link>
                ))}

                <Link
                  to="/nyetableringer"
                  search={{ municipality_code: dashboard.code }}
                  className="flex items-center justify-center gap-3 p-6 text-slate-500 font-black uppercase text-xs tracking-widest hover:text-blue-600 transition-all mt-6 bg-slate-50 rounded-3xl border border-dashed border-slate-200 hover:bg-blue-50/50 hover:border-blue-200 focus-visible:ring-2 focus-visible:ring-blue-600 outline-none"
                >
                  Se alle nyetableringer i {dashboard.name}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </section>
          </div>

          {/* Bankruptcies section - Premium professional look */}
          <div className="mt-16">
            <section className="bg-white rounded-[2.5rem] p-12 border border-slate-100 shadow-sm relative overflow-hidden">
              <h3 className="text-2xl font-black text-slate-900 mb-10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  Siste Konkurser
                </div>
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest">MELDINGER</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dashboard.latest_bankruptcies.length > 0 ? (
                  dashboard.latest_bankruptcies.map(company => (
                    <Link
                      key={company.orgnr}
                      to="/bedrift/$orgnr"
                      params={{ orgnr: company.orgnr }}
                      className="flex items-center justify-between p-6 bg-slate-50 hover:bg-white border border-transparent hover:border-slate-200 rounded-2xl transition-all group focus-visible:ring-2 focus-visible:ring-rose-600 outline-none hover:scale-[1.02]"
                      aria-label={`Se detaljer for ${company.navn}`}
                    >
                      <div className="truncate mr-4">
                        <p className="text-slate-900 font-bold group-hover:text-rose-600 transition-colors truncate text-sm">
                          {company.navn}
                        </p>
                        <p className="text-rose-600 text-xs font-black uppercase tracking-tight mt-1">
                          Konkurs {company.konkursdato || 'nylig'}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-rose-600 transition-all" />
                    </Link>
                  ))
                ) : (
                  <div className="col-span-full py-12 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Ingen nylige konkurser registrert</p>
                  </div>
                )}
              </div>

              <Link
                to="/konkurser"
                search={{ municipality_code: dashboard.code }}
                className="flex items-center justify-center gap-3 p-6 text-slate-500 font-black uppercase text-xs tracking-widest hover:text-rose-600 transition-all mt-10 bg-slate-50 rounded-3xl border border-dashed border-slate-200 hover:bg-rose-50/50 hover:border-rose-200 focus-visible:ring-2 focus-visible:ring-rose-600 outline-none"
              >
                Se alle konkurser i {dashboard.name}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}