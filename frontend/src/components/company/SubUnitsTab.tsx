import { useState, useMemo, useDeferredValue } from 'react'
import { MapPin, Users, Building, AlertCircle, Loader, Calendar, Search, X, ChevronRight } from 'lucide-react'
import { useSubUnitsQuery } from '../../hooks/queries/useSubUnitsQuery'
import type { SubUnit } from '../../types'

interface SubUnitsTabProps {
  orgnr: string
  onSubUnitClick?: (orgnr: string) => void
}

/**
 * Premium UX: Highlights matching text within a string
 */
function HighlightedText({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight.trim()) return <>{text}</>

  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '$&')})`, 'gi')
  const parts = text.split(regex)

  return (
    <>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <mark key={i} className="bg-blue-100 text-blue-900 rounded-sm px-0.5 font-semibold">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

function SubUnitCard({
  unit, 
  onClick, 
  highlight = '' 
}: { 
  unit: SubUnit; 
  onClick?: (orgnr: string) => void;
  highlight?: string;
}) {
  const address = unit.beliggenhetsadresse || unit.postadresse
  const addressLine1 = address?.adresse?.[0] || ''
  const addressLine2 = address?.adresse?.[1] || ''

  const CardWrapper = onClick ? 'button' : 'div'

  return (
    <CardWrapper 
      className={`w-full text-left p-4 bg-white border border-gray-200 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${onClick ? 'cursor-pointer hover:border-blue-400 hover:shadow-md hover:bg-blue-50/30 group' : 'hover:border-blue-300 hover:shadow-md'}`}
      onClick={() => onClick?.(unit.orgnr)}
      aria-label={onClick ? `Se detaljer for ${unit.navn}` : undefined}
    >
      <div className="flex justify-between items-start gap-2 mb-3">
        <div className={`font-semibold text-gray-900 line-clamp-2 ${onClick ? 'group-hover:text-blue-700' : ''}`} title={unit.navn}>
          <HighlightedText text={unit.navn} highlight={highlight} />
        </div>
        {onClick && (
          <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0 mt-0.5" />
        )}
      </div>

      <div className="space-y-2.5 text-sm text-gray-600">
        {address && (
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 mt-0.5 text-gray-400 shrink-0 flex-none" />
            <div>
              {addressLine1 && <div>{addressLine1}</div>}
              {addressLine2 && <div>{addressLine2}</div>}
              <div className="text-xs text-gray-500">
                {address.postnummer} <HighlightedText text={address.poststed} highlight={highlight} />
              </div>
              {address.kommune && (
                <div className="text-xs text-gray-500">
                  <HighlightedText text={address.kommune} highlight={highlight} />
                </div>
              )}
            </div>
          </div>
        )}

        {unit.antall_ansatte !== undefined && unit.antall_ansatte !== null && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400 flex-none" />
            <span>
              {unit.antall_ansatte} {unit.antall_ansatte === 1 ? 'ansatt' : 'ansatte'}
            </span>
          </div>
        )}

        {unit.stiftelsesdato && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400 flex-none" />
            <span>
              Opprettet: {new Date(unit.stiftelsesdato).toLocaleDateString('no-NO')}
            </span>
          </div>
        )}

        <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
          <span title={unit.orgnr}>
            Org.nr: <HighlightedText text={unit.orgnr} highlight={highlight} />
          </span>
          {unit.naeringskode && (
            <span
              className="bg-gray-100 px-2 py-1 rounded truncate max-w-[150px]"
              title={typeof unit.naeringskode === 'object' ? `${unit.naeringskode.kode} - ${unit.naeringskode.beskrivelse}` : unit.naeringskode}
            >
              {typeof unit.naeringskode === 'object' ? unit.naeringskode.kode : unit.naeringskode}
            </span>
          )}
        </div>
      </div>
    </CardWrapper>
  )
}

export function SubUnitsTab({ orgnr, onSubUnitClick }: SubUnitsTabProps) {
  const [isManualFetching, setIsManualFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const deferredSearchTerm = useDeferredValue(searchTerm)
  
  const { data: subunits, isLoading, isError, error, fetchFromBrreg } = useSubUnitsQuery(orgnr)

  // Force fresh fetch from Brønnøysundregistrene
  const handleFetchFromBrreg = async () => {
    setIsManualFetching(true)
    setFetchError(null)
    try {
      await fetchFromBrreg()
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : 'Kunne ikke hente fra Brønnøysund')
    } finally {
      setIsManualFetching(false)
    }
  }

  // Filter subunits based on deferred search term
  const filteredSubunits = useMemo(() => {
    if (!subunits) return []
    if (!deferredSearchTerm.trim()) return subunits

    const term = deferredSearchTerm.toLowerCase().trim()
    return subunits.filter((unit) => {
      const address = unit.beliggenhetsadresse || unit.postadresse
      const poststed = address?.poststed?.toLowerCase() || ''
      const kommune = address?.kommune?.toLowerCase() || ''
      
      return (
        unit.navn.toLowerCase().includes(term) ||
        unit.orgnr.includes(term) ||
        poststed.includes(term) ||
        kommune.includes(term)
      )
    })
  }, [subunits, deferredSearchTerm])

  const isBusy = isLoading || isManualFetching

  if (isLoading) {
    return (
      <div className="p-12 text-center">
        <Loader className="h-8 w-8 text-blue-600 mx-auto mb-4 animate-spin" />
        <p className="text-gray-600">Laster avdelinger...</p>
      </div>
    )
  }

  if (isError || fetchError) {
    const errorMessage = fetchError || (error instanceof Error ? error.message : 'Prøv igjen senere')
    return (
      <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-medium">Kunne ikke laste avdelinger</p>
            <p className="text-sm text-red-600 mt-1">{errorMessage}</p>
          </div>
        </div>
        <button
          onClick={handleFetchFromBrreg}
          disabled={isBusy}
          className="ml-4 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 whitespace-nowrap inline-flex items-center gap-2"
        >
          {isBusy && <Loader className="h-3 w-3 animate-spin" />}
          {isBusy ? 'Henter...' : 'Prøv igjen'}
        </button>
      </div>
    )
  }

  if (!subunits || subunits.length === 0) {
    return (
      <div className="p-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
        <Building className="h-8 w-8 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-600 font-medium mb-1">Ingen avdelinger funnet</p>
        <p className="text-sm text-gray-500 mb-4">
          Denne bedriften har ingen registrerte underenheter eller avdelinger i Brønnøysundregistrene.
        </p>
        <button
          onClick={handleFetchFromBrreg}
          disabled={isBusy}
          className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
        >
          {isBusy && <Loader className="h-3 w-3 animate-spin" />}
          {isBusy ? 'Henter fra Brønnøysund...' : 'Hent fra Brønnøysund'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2 whitespace-nowrap">
          <Building className="h-5 w-5 text-blue-600" aria-hidden="true" />
          <span>{subunits.length} {subunits.length === 1 ? 'avdeling' : 'avdelinger'}</span>
          {deferredSearchTerm && (
            <span className="text-gray-500 font-normal text-sm italic">
              ({filteredSubunits.length} treff)
            </span>
          )}
        </h3>

        {/* Local Search Input */} 
        <div className="relative w-full max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
          </div>
          <input
            type="text"
            role="searchbox"
            aria-label="Søk i avdelinger"
            className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-xs"
            placeholder="Søk i avdelinger (navn, sted, org.nr)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
              title="Tøm søk"
              aria-label="Tøm søk"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {filteredSubunits.length > 0 ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSubunits.map((unit) => (
            <SubUnitCard 
              key={unit.orgnr} 
              unit={unit} 
              onClick={onSubUnitClick} 
              highlight={deferredSearchTerm}
            />
          ))}
        </div>
      ) : (
        <div className="p-12 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
          <p className="text-gray-500 italic">
            Ingen avdelinger matchet søket "{deferredSearchTerm}"
          </p>
          <button
            onClick={() => setSearchTerm('')}
            className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium focus:outline-none focus:underline"
          >
            Vis alle avdelinger
          </button>
        </div>
      )}
    </div>
  )
}