import { COUNTIES } from '../../constants/explorer'

interface ActiveFilterChipsProps {
  searchQuery: string
  organizationForms: string[]
  naeringskode: string
  municipality: string
  county: string
  revenueMin: number | null
  revenueMax: number | null
  profitMin: number | null
  profitMax: number | null
  equityMin: number | null
  equityMax: number | null
  employeeMin: number | null
  employeeMax: number | null
  foundedFrom: Date | null
  foundedTo: Date | null
  bankruptFrom: Date | null
  bankruptTo: Date | null
  isBankrupt: boolean | null
  inLiquidation: boolean | null
  inForcedLiquidation: boolean | null
  onClearSearch: () => void
}

export function ActiveFilterChips({
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
  employeeMin,
  employeeMax,
  foundedFrom,
  foundedTo,
  bankruptFrom,
  bankruptTo,
  isBankrupt,
  inLiquidation,
  inForcedLiquidation,
  onClearSearch
}: ActiveFilterChipsProps) {
  return (
    <div className="mt-6 pt-4 border-t border-gray-100">
      <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
        <span className="font-medium">Aktive filtre:</span>
        <div className="flex flex-wrap gap-2">
          {searchQuery && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded flex items-center gap-1">
              Søk: "{searchQuery}"
              <button
                onClick={onClearSearch}
                className="ml-1 hover:text-blue-900"
                title="Fjern søkefilter"
              >
                ×
              </button>
            </span>
          )}
          {organizationForms.length > 0 && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
              {organizationForms.length} org.form
            </span>
          )}
          {naeringskode && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
              Næring: {naeringskode}
            </span>
          )}
          {municipality && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
              Kommune: {municipality}
            </span>
          )}
          {county && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
              Fylke: {COUNTIES.find(c => c.code === county)?.name || county}
            </span>
          )}
          {(revenueMin !== null || revenueMax !== null) && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
              Inntekt
            </span>
          )}
          {(profitMin !== null || profitMax !== null) && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
              Resultat
            </span>
          )}
          {(equityMin !== null || equityMax !== null) && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
              Egenkapital
            </span>
          )}
          {(employeeMin !== null || employeeMax !== null) && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
              Ansatte
            </span>
          )}
          {(foundedFrom !== null || foundedTo !== null) && (
            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">
              Stiftelsesdato
            </span>
          )}
          {(bankruptFrom !== null || bankruptTo !== null) && (
            <span className="px-2 py-1 bg-red-50 text-red-700 rounded">
              Konkursdato
            </span>
          )}
          {(isBankrupt || inLiquidation || inForcedLiquidation) && (
            <span className="px-2 py-1 bg-red-50 text-red-700 rounded">
              Statusfilter
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
