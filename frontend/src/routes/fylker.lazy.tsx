/* eslint-disable react-refresh/only-export-components */
import { createLazyFileRoute, Link } from '@tanstack/react-router'
import { useCountiesListQuery } from '../hooks/queries/useCountyQuery'
import { SEOHead, Breadcrumbs } from '../components/layout'
import { Loader2, MapPin, ChevronRight } from 'lucide-react'
import { formatNumber } from '../utils/formatters'
import { createRouteCode } from '../utils/slugify'
import { getStaticMapUrl } from '../utils/mapTiles'

const COUNTY_MAP_CLASS =
  'absolute inset-0 opacity-60 group-hover:opacity-75 transition-opacity pointer-events-none bg-cover bg-center filter contrast-125 brightness-95'
const COUNTY_MAP_OVERLAY_CLASS =
  'absolute inset-0 bg-linear-to-b from-white/30 via-white/10 to-white/40 pointer-events-none'

export const Route = createLazyFileRoute('/fylker')({
  component: FylkerPage,
})

export function FylkerPage() {
  const { data: counties, isLoading, isError, refetch } = useCountiesListQuery()

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      <SEOHead
        title="Norske Fylker - Næringsliv & Statistikk | Bedriftsgrafen.no"
        description="Oversikt over alle 15 norske fylker og deres næringsliv. Se virksomhetsstatistikk, folketall og regionale trender."
      />

      <div className="bg-white border-b border-slate-200">
        <Breadcrumbs
          items={[
            { label: 'Hjem', to: '/' },
            { label: 'Fylker' }
          ]}
        />
      </div>

      <main className="max-w-7xl mx-auto px-4 py-16">
        <div className="max-w-3xl mb-16">
          <h1 className="text-6xl md:text-7xl font-black text-slate-900 tracking-tight mb-8">
            Norske <span className="text-blue-600">Fylker</span>
          </h1>
          <p className="text-slate-600 text-xl font-medium leading-relaxed">
            Utforsk næringslivets regionale struktur og utvikling på tvers av alle 15 fylker.
            Velg et fylke for å se detaljert statistikk, topplister og kommuneoversikt.
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-6" />
            <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">Henter fylkesoversikt...</p>
          </div>
        ) : isError ? (
          <div className="text-center py-32 bg-white rounded-3xl border border-dashed border-rose-200">
            <MapPin className="h-12 w-12 text-rose-300 mx-auto mb-4" />
            <p className="text-slate-600 font-bold text-lg mb-4">Kunne ikke laste fylkesoversikten.</p>
            <button
              onClick={() => refetch()}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors"
            >
              Prøv igjen
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {counties?.sort((a, b) => b.company_count - a.company_count).map(county => (
              <Link
                key={county.code}
                to="/fylke/$code"
                params={{ code: createRouteCode(county.code, county.name) }}
                className="group bg-white rounded-3xl p-10 border border-slate-200 hover:border-blue-200 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 flex flex-col justify-between relative overflow-hidden"
              >
                {/* Static Map Background */}
                {county.lat && county.lng && (
                  <div
                    className={COUNTY_MAP_CLASS}
                    style={{
                      backgroundImage: `url(${getStaticMapUrl(county.lat, county.lng, 9)})`,
                    }}
                  />
                )}
                <div className={COUNTY_MAP_OVERLAY_CLASS} />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <div className="h-16 w-16 bg-slate-50/90 backdrop-blur-sm border border-slate-200/50 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500 transition-all duration-300 shadow-sm">
                      <MapPin className="h-7 w-7" />
                    </div>
                    <span className="text-[10px] font-black text-slate-500 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full group-hover:text-blue-600 group-hover:bg-blue-50/90 transition-colors tracking-[0.2em] uppercase">
                      KODE {county.code}
                    </span>
                  </div>
                  <h2 className="text-3xl font-black text-slate-900 mb-3 group-hover:text-blue-700 transition-colors leading-tight tracking-tight drop-shadow-sm">
                    {county.name}
                  </h2>
                  <p className="text-slate-600 text-sm font-semibold">
                    {county.municipality_count === 1 ? '1 kommune' : `${county.municipality_count} kommuner`}
                  </p>
                  <div className="h-1 w-8 bg-slate-200/80 rounded-full group-hover:w-12 group-hover:bg-blue-500 transition-all duration-300 mt-4" />
                </div>

                <div className="mt-10 pt-8 border-t border-slate-200/50 grid grid-cols-2 gap-6 relative z-10 bg-white/80 backdrop-blur-sm -mx-10 -mb-10 px-10 pb-10 rounded-b-3xl">
                  <div className="flex flex-col">
                    <span className="text-slate-900 font-black tabular-nums text-2xl tracking-tighter">
                      {formatNumber(county.company_count)}
                    </span>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
                      Virksomheter
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-slate-900 font-black tabular-nums text-2xl tracking-tighter">
                      {county.population ? formatNumber(county.population) : '—'}
                    </span>
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">
                      Innbyggere
                    </span>
                  </div>

                  <div className="col-span-2 mt-6 flex items-center justify-center gap-2 text-blue-600 font-black uppercase text-[10px] tracking-widest group-hover:underline">
                    Utforsk fylket
                    <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!isLoading && (!counties || counties.length === 0) && (
          <div className="text-center py-32 bg-white rounded-3xl border border-dashed border-slate-200">
            <MapPin className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-bold text-lg">Ingen fylker funnet.</p>
          </div>
        )}
      </main>
    </div>
  )
}
