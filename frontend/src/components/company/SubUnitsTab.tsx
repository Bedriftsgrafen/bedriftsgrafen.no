import { useState } from 'react'
import { MapPin, Users, Building, AlertCircle, Loader } from 'lucide-react'
import { useSubUnitsQuery } from '../../hooks/queries/useSubUnitsQuery'
import type { SubUnit } from '../../types'

interface SubUnitsTabProps {
  orgnr: string
}

function SubUnitCard({ unit }: { unit: SubUnit }) {
  const address = unit.beliggenhetsadresse || unit.postadresse
  const addressLine1 = address?.adresse?.[0] || ''
  const addressLine2 = address?.adresse?.[1] || ''

  return (
    <div className="p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all">
      <div className="font-medium text-gray-900 mb-3 line-clamp-2" title={unit.navn}>
        {unit.navn}
      </div>

      <div className="space-y-2.5 text-sm text-gray-600">
        {address && (
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 mt-0.5 text-gray-400 shrink-0 flex-none" />
            <div>
              {addressLine1 && <div>{addressLine1}</div>}
              {addressLine2 && <div>{addressLine2}</div>}
              <div className="text-xs text-gray-500">
                {address.postnummer} {address.poststed}
              </div>
              {address.kommune && (
                <div className="text-xs text-gray-500">{address.kommune}</div>
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

        <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
          <span title={unit.orgnr}>Org.nr: {unit.orgnr}</span>
          {unit.naeringskode && (
            <span className="bg-gray-100 px-2 py-1 rounded" title={unit.naeringskode}>
              {unit.naeringskode}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function SubUnitsTab({ orgnr }: SubUnitsTabProps) {
  const [isManualFetching, setIsManualFetching] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
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
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Building className="h-5 w-5 text-blue-600" />
          {subunits.length} {subunits.length === 1 ? 'avdeling' : 'avdelinger'}
        </h3>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {subunits.map((unit) => (
          <SubUnitCard key={unit.orgnr} unit={unit} />
        ))}
      </div>
    </div>
  )
}
