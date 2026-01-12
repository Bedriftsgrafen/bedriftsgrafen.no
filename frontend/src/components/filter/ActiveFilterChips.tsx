import { useFilterStore } from '../../store/filterStore'
import { COUNTIES } from '../../constants/explorer'
import { useCallback } from 'react'
import { X } from 'lucide-react'

export function ActiveFilterChips() {
  const filters = useFilterStore(useCallback(s => ({
    searchQuery: s.searchQuery,
    organizationForms: s.organizationForms,
    naeringskode: s.naeringskode,
    municipality: s.municipality,
    county: s.county,
    revenueMin: s.revenueMin,
    revenueMax: s.revenueMax,
    profitMin: s.profitMin,
    profitMax: s.profitMax,
    equityMin: s.equityMin,
    equityMax: s.equityMax,
    operatingProfitMin: s.operatingProfitMin,
    operatingProfitMax: s.operatingProfitMax,
    liquidityRatioMin: s.liquidityRatioMin,
    liquidityRatioMax: s.liquidityRatioMax,
    equityRatioMin: s.equityRatioMin,
    equityRatioMax: s.equityRatioMax,
    employeeMin: s.employeeMin,
    employeeMax: s.employeeMax,
    foundedFrom: s.foundedFrom,
    foundedTo: s.foundedTo,
    bankruptFrom: s.bankruptFrom,
    bankruptTo: s.bankruptTo,
    isBankrupt: s.isBankrupt,
    inLiquidation: s.inLiquidation,
    inForcedLiquidation: s.inForcedLiquidation,
    hasAccounting: s.hasAccounting,
  }), []))

  const setSearchQuery = useFilterStore(s => s.setSearchQuery)

  const onClearSearch = useCallback(() => {
    setSearchQuery('')
  }, [setSearchQuery])

  const {
    searchQuery,
    organizationForms,
    naeringskode,
    municipality,
    county,
    revenueMin,
    revenueMax,
    profitMin,
    profitMax,
    equityMin,
    equityMax,
    operatingProfitMin,
    operatingProfitMax,
    liquidityRatioMin,
    liquidityRatioMax,
    equityRatioMin,
    equityRatioMax,
    employeeMin,
    employeeMax,
    foundedFrom,
    foundedTo,
    bankruptFrom,
    bankruptTo,
    isBankrupt,
    inLiquidation,
    inForcedLiquidation,
    hasAccounting,
  } = filters

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
              Kommune: {municipality}
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
}
