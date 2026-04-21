/* eslint-disable react-refresh/only-export-components */
import { createLazyFileRoute } from '@tanstack/react-router'
import { useCountiesListQuery } from '../hooks/queries/useCountyQuery'
import { SEOHead, Breadcrumbs } from '../components/layout'
import { Loader2, MapPin } from 'lucide-react'
import { createRouteCode } from '../utils/slugify'
import { RegionCard } from '../components/regions/RegionCard'

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
            { label: 'Regioner', to: '/regioner' },
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
          <div className="text-center py-16 md:py-32 bg-white rounded-2xl md:rounded-3xl border border-dashed border-rose-200">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
            {counties?.sort((a, b) => b.company_count - a.company_count).map(county => (
              <RegionCard
                key={county.code}
                kind="fylke"
                code={county.code}
                name={county.name}
                slug={createRouteCode(county.code, county.name)}
                companyCount={county.company_count}
                population={county.population}
                municipalityCount={county.municipality_count}
                lat={county.lat}
                lng={county.lng}
              />
            ))}
          </div>
        )}

        {!isLoading && (!counties || counties.length === 0) && (
          <div className="text-center py-16 md:py-32 bg-white rounded-2xl md:rounded-3xl border border-dashed border-slate-200">
            <MapPin className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-bold text-lg">Ingen fylker funnet.</p>
          </div>
        )}
      </main>
    </div>
  )
}
