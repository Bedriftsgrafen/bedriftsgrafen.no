import { createLazyFileRoute } from '@tanstack/react-router'
import { useMunicipalitiesListQuery } from '../hooks/queries/useMunicipalityQuery'
import { SEOHead, Breadcrumbs } from '../components/layout'
import { Loader2, MapPin, Search, ChevronDown } from 'lucide-react'
import { useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { HeroMap } from '../components/maps/HeroMap'
import { COUNTIES } from '../constants/explorer'

export const Route = createLazyFileRoute('/kommuner')({
  component: KommunerPage,
})

function KommunerPage() {
  const { data: municipalities, isLoading } = useMunicipalitiesListQuery()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCounty, setSelectedCounty] = useState<string>('all')

  const counties = useMemo(() => {
    return [
      { code: 'all', name: 'Alle fylker' },
      ...COUNTIES
    ]
  }, [])

  const filtered = useMemo(() => {
    if (!municipalities) return []
    const query = searchQuery.toLowerCase()
    return municipalities
      .filter(m => {
        const matchesQuery = m.name.toLowerCase().includes(query) || m.code.includes(query)
        const matchesCounty = selectedCounty === 'all' || m.code.startsWith(selectedCounty)
        return matchesQuery && matchesCounty
      })
      .sort((a, b) => b.company_count - a.company_count)
  }, [municipalities, searchQuery, selectedCounty])

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
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

      <main className="max-w-7xl mx-auto px-4 py-16">
        <div className="max-w-3xl mb-16">
          <h1 className="text-6xl md:text-7xl font-black text-slate-900 tracking-tight mb-8">
            Norske <span className="text-blue-600">Kommuner</span>
          </h1>
          <p className="text-slate-600 text-xl font-medium leading-relaxed">
            Utforsk næringslivets struktur og utvikling på tvers av alle 357 kommuner. Velg et fylke for å snevre inn søket eller bruk fritekstsøk for å finne din region.
          </p>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col md:flex-row gap-4 mb-12">
          {/* Search Bar */}
          <div className="relative flex-1 group">
            <input
              type="text"
              placeholder="Søk på navn eller kommunenummer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none shadow-sm transition-all text-lg font-medium"
            />
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
          </div>

          {/* County Select */}
          <div className="relative md:w-72">
            <select
              value={selectedCounty}
              onChange={(e) => setSelectedCounty(e.target.value)}
              className="w-full h-full pl-6 pr-12 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none shadow-sm transition-all text-lg font-medium appearance-none cursor-pointer"
            >
              {counties.map(c => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-6" />
            <p className="text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">Oppdaterer register...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {filtered.map(m => (
              <Link
                key={m.code}
                to="/kommune/$code"
                params={{ code: m.slug }}
                className="group bg-white rounded-3xl p-8 border border-slate-200 hover:border-blue-200 shadow-sm hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 flex flex-col justify-between relative overflow-hidden"
              >
                {/* 
                   Background Context Map
                   Reduced opacity for more "premium" feel. Map serves as a subtle texture.
                */}
                {m.lat && m.lng && (
                  <div className="absolute inset-0 opacity-15 group-hover:opacity-25 transition-opacity pointer-events-none">
                    <HeroMap lat={m.lat} lng={m.lng} zoom={9} variant="light" />
                  </div>
                )}
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8">
                    <div className="h-14 w-14 bg-slate-50 border border-slate-100 text-slate-400 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-500 transition-all duration-300">
                      <MapPin className="h-6 w-6" />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 group-hover:text-blue-600 transition-colors tracking-[0.2em] uppercase">
                      {m.code}
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 mb-2 group-hover:text-blue-700 transition-colors leading-tight tracking-tight">
                    {m.name}
                  </h3>
                  <div className="h-1 w-8 bg-slate-100 rounded-full group-hover:w-12 group-hover:bg-blue-500 transition-all duration-300 mb-4" />
                </div>

                <div className="mt-8 pt-8 border-t border-slate-50 flex items-center justify-between relative z-10">
                  <div className="flex flex-col">
                    <span className="text-slate-900 font-black tabular-nums text-xl tracking-tighter">{m.company_count.toLocaleString('no-NO')}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Selskaper</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-slate-900 font-black tabular-nums text-xl tracking-tighter">{m.population?.toLocaleString('no-NO') ?? '-'}</span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Innbyggere</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-32 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
            <Search className="h-12 w-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-bold text-lg">Ingen kommuner samsvarte med søket ditt.</p>
            <button 
              onClick={() => { setSearchQuery(''); setSelectedCounty('all'); }}
              className="mt-4 text-blue-600 font-black uppercase text-[10px] tracking-widest hover:underline"
            >
              Nullstill filtre
            </button>
          </div>
        )}
      </main>
    </div>
  )
}