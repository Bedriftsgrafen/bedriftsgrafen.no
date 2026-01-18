import { useFilterStore } from '../../store/filterStore'
import { COUNTIES } from '../../constants/explorer'
import { formatMunicipalityName } from '../../constants/municipalities'
import { memo, useCallback } from 'react'
import { X } from 'lucide-react'

export const ActiveFilterChips = memo(function ActiveFilterChips() {
  const searchQuery = useFilterStore(s => s.searchQuery)
  const organizationForms = useFilterStore(s => s.organizationForms)
  const naeringskode = useFilterStore(s => s.naeringskode)
  const municipality = useFilterStore(s => s.municipality)
  const county = useFilterStore(s => s.county)
  const revenueMin = useFilterStore(s => s.revenueMin)
  const revenueMax = useFilterStore(s => s.revenueMax)
  const profitMin = useFilterStore(s => s.profitMin)
  const profitMax = useFilterStore(s => s.profitMax)
  const equityMin = useFilterStore(s => s.equityMin)
  const equityMax = useFilterStore(s => s.equityMax)
  const operatingProfitMin = useFilterStore(s => s.operatingProfitMin)
  const operatingProfitMax = useFilterStore(s => s.operatingProfitMax)
  const liquidityRatioMin = useFilterStore(s => s.liquidityRatioMin)
  const liquidityRatioMax = useFilterStore(s => s.liquidityRatioMax)
  const equityRatioMin = useFilterStore(s => s.equityRatioMin)
  const equityRatioMax = useFilterStore(s => s.equityRatioMax)
  const employeeMin = useFilterStore(s => s.employeeMin)
  const employeeMax = useFilterStore(s => s.employeeMax)
  const foundedFrom = useFilterStore(s => s.foundedFrom)
  const foundedTo = useFilterStore(s => s.foundedTo)
  const bankruptFrom = useFilterStore(s => s.bankruptFrom)
  const bankruptTo = useFilterStore(s => s.bankruptTo)
  const isBankrupt = useFilterStore(s => s.isBankrupt)
  const inLiquidation = useFilterStore(s => s.inLiquidation)
  const inForcedLiquidation = useFilterStore(s => s.inForcedLiquidation)
  const hasAccounting = useFilterStore(s => s.hasAccounting)
  const municipalityCode = useFilterStore(s => s.municipalityCode)

  const setSearchQuery = useFilterStore(s => s.setSearchQuery)

  const onClearSearch = useCallback(() => {
    setSearchQuery('')
  }, [setSearchQuery])

  return (
    <div className="mt-6 pt-4 border-t border-gray-100">
      <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
        <span className="font-medium">Aktive filtre:</span>
        <div className="flex flex-wrap gap-2">
          {searchQuery && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded flex items-center gap-1 border border-blue-100 shadow-sm">
              Søk: "{searchQuery}"
              <button
                onClick={onClearSearch}
                className="ml-1 hover:text-blue-900 transition-colors"
                title="Fjern søkefilter"
                aria-label="Fjern søkefilter"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {organizationForms.length > 0 && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-100 shadow-sm">
              {organizationForms.length} org.form
            </span>
          )}
          {naeringskode && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-100 shadow-sm">
              Næring: {naeringskode}
            </span>
          )}
          {municipality && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-100 shadow-sm">
              Kommune: {formatMunicipalityName(municipality)}
            </span>
          )}
          {municipalityCode && !municipality && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-100 shadow-sm">
              Kommune (kode): {municipalityCode}
            </span>
          )}
          {county && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-100 shadow-sm">
              Fylke: {COUNTIES.find(c => c.code === county)?.name || county}
            </span>
          )}
          {(revenueMin !== null || revenueMax !== null) && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-100 shadow-sm">
              Inntekt
            </span>
          )}
          {(profitMin !== null || profitMax !== null) && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-100 shadow-sm">
              Resultat
            </span>
          )}
          {(equityMin !== null || equityMax !== null) && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-100 shadow-sm">
              Egenkapital
            </span>
          )}
          {(operatingProfitMin !== null || operatingProfitMax !== null) && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-100 shadow-sm">
              Driftsresultat
            </span>
          )}
          {(liquidityRatioMin !== null || liquidityRatioMax !== null) && (
            <span className="px-2 py-1 bg-green-50 text-green-700 rounded border border-green-100 shadow-sm">
              Likviditetsgrad
            </span>
          )}
          {(equityRatioMin !== null || equityRatioMax !== null) && (
            <span className="px-2 py-1 bg-green-50 text-green-700 rounded border border-green-100 shadow-sm">
              Egenkapitalandel
            </span>
          )}
          {(employeeMin !== null || employeeMax !== null) && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-100 shadow-sm">
              Ansatte
            </span>
          )}
          {(foundedFrom !== null || foundedTo !== null) && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-100 shadow-sm">
              Stiftelsesdato
            </span>
          )}
          {(bankruptFrom !== null || bankruptTo !== null) && (
            <span className="px-2 py-1 bg-red-50 text-red-700 rounded border border-red-100 shadow-sm">
              Konkursdato
            </span>
          )}
          {(isBankrupt !== null || inLiquidation !== null || inForcedLiquidation !== null) && (
            <span className="px-2 py-1 bg-red-50 text-red-700 rounded border border-red-100 shadow-sm">
              Statusfilter
            </span>
          )}
          {hasAccounting !== null && (
            <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded border border-purple-100 shadow-sm">
              {hasAccounting ? 'Med regnskap' : 'Uten regnskap'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
})
