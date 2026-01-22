import { createLazyFileRoute } from '@tanstack/react-router'
import { useMunicipalitiesListQuery } from '../hooks/queries/useMunicipalityQuery'
import { SEOHead, Breadcrumbs } from '../components/layout'
import { Loader2, MapPin, Search } from 'lucide-react'
import { useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { HeroMap } from '../components/maps/HeroMap'

export const Route = createLazyFileRoute('/kommuner')({
  component: KommunerPage,
})

function KommunerPage() {
  const { data: municipalities, isLoading } = useMunicipalitiesListQuery()
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = useMemo(() => {
    if (!municipalities) return []
    const query = searchQuery.toLowerCase()
    return municipalities
      .filter(m => m.name.toLowerCase().includes(query) || m.code.includes(query))
      .sort((a, b) => b.company_count - a.company_count)
  }, [municipalities, searchQuery])

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <SEOHead
        title="Norske Kommuner - Bedriftsgrafen.no"
        description="Oversikt over alle 357 norske kommuner, deres næringsliv, virksomhetstetthet og folketall. Finn din kommune og se lokal statistikk."
      />

      <div className="bg-white border-b border-slate-200">
        <Breadcrumbs
          items={[
            { label: 'Hjem', to: '/' },
            { label: 'Kommuner' }
          ]}
        />
      </div>

      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-12">
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight mb-6">
            Norske Kommuner
          </h1>
          <p className="text-slate-600 text-xl max-w-2xl font-medium leading-relaxed">
            Utforsk næringslivet i din region. Vi følger utviklingen i alle 357 kommuner i Norge og gir deg oppdatert lokal innsikt.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-12 group max-w-xl">
          <input
            type="text"
            placeholder="Søk etter kommune eller kommunenummer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-6 py-5 bg-white border border-slate-200 rounded-3xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none shadow-sm transition-all text-xl font-medium"
          />
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Henter kommuner...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filtered.map(m => (
              <Link
                key={m.code}
                to="/kommune/$code"
                params={{ code: m.slug }}
                className="group bg-white rounded-3xl p-8 border border-slate-200 hover:border-blue-300 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between relative overflow-hidden"
              >
                {/* 
                   Background Context Map
                   
                   ===== TWEAK GUIDE =====
                   Change the className below to switch presets:
                   
                   PRESET A (recommended): "absolute inset-0 opacity-30 group-hover:opacity-50 transition-opacity pointer-events-none sepia saturate-200 hue-rotate-180 contrast-125"
                   PRESET B (high contrast): "absolute inset-0 opacity-40 group-hover:opacity-60 transition-opacity pointer-events-none grayscale contrast-200 brightness-90"
                   PRESET C (strong gray):   "absolute inset-0 opacity-50 group-hover:opacity-70 transition-opacity pointer-events-none grayscale contrast-200"
                   PRESET D (inverted):      "absolute inset-0 opacity-25 group-hover:opacity-40 transition-opacity pointer-events-none invert contrast-150"
                   
                   CSS FILTER REFERENCE:
                   - opacity-XX: 10-100 (visibility, higher = more visible)
                   - contrast-XX: 50-200 (feature definition)
                   - brightness-XX: 50-150 (lightness)
                   - grayscale: removes color
                   - sepia: warm brownish tint
                   - hue-rotate-XX: 0-360 (color shift, 180 = blue from sepia)
                   - invert: flips colors
                   - saturate-XX: 0-200 (color intensity)
                */}
                {m.lat && m.lng && (
                  <div className="absolute inset-0 opacity-100 contrast-90 saturate-100 hue-rotate-10 group-hover:opacity-80 transition-opacity pointer-events-none">
                    <HeroMap lat={m.lat} lng={m.lng} zoom={10} variant="light" />
                  </div>
                )}
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="h-14 w-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <MapPin className="h-7 w-7" />
                    </div>
                    <span className="text-xs font-black text-slate-500 group-hover:text-blue-600 transition-colors tracking-widest">
                      NR {m.code}
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2 group-hover:text-blue-700 transition-colors leading-tight">
                    {m.name}
                  </h3>
                  <p className="text-slate-700 text-xs font-bold uppercase tracking-tight">Kommune</p>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between relative z-10">
                  <div className="flex flex-col">
                    <span className="text-slate-900 font-black tabular-nums text-xl">{m.company_count.toLocaleString('no-NO')}</span>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">VIRKSOMHETER</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-slate-900 font-black tabular-nums text-xl">{m.population?.toLocaleString('no-NO') ?? '-'}</span>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">INNBYGGERE</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
            <p className="text-slate-500 font-bold">Ingen kommuner samsvarte med søket ditt.</p>
          </div>
        )}
      </main>
    </div>
  )
}
