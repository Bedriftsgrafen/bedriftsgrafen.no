/* eslint-disable react-refresh/only-export-components */
import { createLazyFileRoute, Link } from '@tanstack/react-router'
import { useCountiesListQuery } from '../hooks/queries/useCountyQuery'
import { useMunicipalitiesListQuery } from '../hooks/queries/useMunicipalityQuery'
import { SEOHead, Breadcrumbs } from '../components/layout'
import { Loader2, MapPin } from 'lucide-react'
import { useState, useMemo, useRef, useEffect } from 'react'
import { createRouteCode } from '../utils/slugify'
import { RegionCard } from '../components/regions/RegionCard'
import { RegionFilterBar, type Segment } from '../components/regions/RegionFilterBar'

export const Route = createLazyFileRoute('/regioner')({
  component: RegionerPage,
})

export function RegionerPage() {
  const { data: counties, isLoading: countiesLoading } = useCountiesListQuery()
  const { data: municipalities, isLoading: municipalitiesLoading } =
    useMunicipalitiesListQuery()

  const [searchQuery, setSearchQuery] = useState('')
  const [segment, setSegment] = useState<Segment>('all')
  const searchRef = useRef<HTMLInputElement>(null)

  const isLoading = countiesLoading || municipalitiesLoading
  const q = searchQuery.trim().toLowerCase()

  // Autofocus on mount
  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // Escape clears query
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchQuery('')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const filteredFylker = useMemo(() => {
    const base = counties?.slice().sort((a, b) => b.company_count - a.company_count) ?? []
    if (!q) return base
    return base.filter(
      c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q),
    )
  }, [counties, q])

  const filteredKommuner = useMemo(() => {
    const sorted =
      municipalities
        ?.slice()
        .sort((a, b) => b.company_count - a.company_count) ?? []
    if (!q) return sorted.slice(0, 20)
    return sorted.filter(
      m => m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q),
    )
  }, [municipalities, q])

  const totalKommuner = municipalities?.length ?? 0

  const showFylker = segment === 'all' || segment === 'fylker'
  const showKommuner = segment === 'all' || segment === 'kommuner'

  const visibleFylkerCount = showFylker ? filteredFylker.length : Infinity
  const visibleKommunerCount = showKommuner ? filteredKommuner.length : Infinity
  const isEmpty = visibleFylkerCount === 0 && visibleKommunerCount === 0

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      <SEOHead
        title="Regioner – Norske fylker og kommuner | Bedriftsgrafen.no"
        description="Finn og utforsk alle norske fylker og kommuner. Søk direkte etter navn eller kommunenummer for å gå rett til regionen du vil utforske."
      />

      <div className="bg-white border-b border-slate-200">
        <Breadcrumbs
          items={[
            { label: 'Hjem', to: '/' },
            { label: 'Regioner' },
          ]}
        />
      </div>

      <main className="max-w-7xl mx-auto px-4 py-16">
        <header className="max-w-3xl mb-12">
          <h1 className="text-6xl md:text-7xl font-black text-slate-900 tracking-tight mb-8">
            Utforsk norske <span className="text-blue-600">Regioner</span>
          </h1>
          <p className="text-slate-600 text-xl font-medium leading-relaxed">
            Finn fylket eller kommunen du leter etter. Naviger direkte til dashbord for
            detaljert statistikk, trender og topplister.
          </p>
        </header>

        <RegionFilterBar
          searchQuery={searchQuery}
          segment={segment}
          onSearchChange={setSearchQuery}
          onSegmentChange={setSegment}
          searchRef={searchRef}
        />

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-6" />
            <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">
              Henter regioner...
            </p>
          </div>
        ) : isEmpty ? (
          /* Empty state */
          <div
            className="text-center py-24 bg-white rounded-3xl border border-dashed border-slate-200"
            data-testid="empty-state"
          >
            <MapPin className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-700 font-bold text-lg mb-2">Ingen regioner funnet.</p>
            <p className="text-slate-500 mb-6">
              Prøv et annet søk, eller utforsk alle virksomheter.
            </p>
            <Link
              to="/utforsk"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-900 text-white rounded-2xl font-bold hover:bg-blue-800 transition-colors"
            >
              Utforsk alle virksomheter
            </Link>
          </div>
        ) : (
          <>
            {/* Fylker section */}
            {showFylker && filteredFylker.length > 0 && (
              <section aria-labelledby="fylker-heading" className="mb-20">
                <div className="flex items-baseline justify-between mb-8">
                  <h2
                    id="fylker-heading"
                    className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight"
                  >
                    Fylker{' '}
                    <span className="text-slate-400 font-semibold text-lg">
                      · {filteredFylker.length}
                    </span>
                  </h2>
                  {!q && (
                    <Link
                      to="/fylker"
                      className="text-blue-600 font-bold hover:text-blue-700 text-sm"
                    >
                      Fylkeoversikt →
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                  {filteredFylker.map(county => (
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
              </section>
            )}

            {/* Kommuner section */}
            {showKommuner && filteredKommuner.length > 0 && (
              <section aria-labelledby="kommuner-heading">
                <div className="flex items-baseline justify-between mb-8">
                  <h2
                    id="kommuner-heading"
                    className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight"
                  >
                    Kommuner{' '}
                    <span className="text-slate-400 font-semibold text-lg">
                      {q
                        ? `· ${filteredKommuner.length} treff`
                        : `· topp ${filteredKommuner.length} av ${totalKommuner}`}
                    </span>
                  </h2>
                  {!q && (
                    <Link
                      to="/kommuner"
                      className="text-blue-600 font-bold hover:text-blue-700 text-sm"
                      data-testid="vis-alle-link"
                    >
                      Vis alle {totalKommuner} kommuner →
                    </Link>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                  {filteredKommuner.map(m => (
                    <RegionCard
                      key={m.code}
                      kind="kommune"
                      code={m.code}
                      name={m.name}
                      slug={m.slug}
                      companyCount={m.company_count}
                      population={m.population}
                      lat={m.lat}
                      lng={m.lng}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
