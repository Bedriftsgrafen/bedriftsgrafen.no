interface StatusFiltersProps {
  isBankrupt: boolean | null
  inLiquidation: boolean | null
  inForcedLiquidation: boolean | null
  onStatusChange: (key: 'isBankrupt' | 'inLiquidation' | 'inForcedLiquidation', value: boolean | null) => void
}

const STATUS_OPTIONS = [
  { key: 'isBankrupt' as const, label: 'Konkurs', yesLabel: 'Konkurs', noLabel: 'Ikke konkurs' },
  { key: 'inLiquidation' as const, label: 'Avvikling', yesLabel: 'Under avvikling', noLabel: 'Ikke avvikling' },
  { key: 'inForcedLiquidation' as const, label: 'Tvangsavvikling', yesLabel: 'Tvangsavvikling', noLabel: 'Ikke tvangsavvikling' },
] as const

export function StatusFilters({
  isBankrupt,
  inLiquidation,
  inForcedLiquidation,
  onStatusChange
}: StatusFiltersProps) {
  const values = { isBankrupt, inLiquidation, inForcedLiquidation }

  return (
    <div className="space-y-4">
      {STATUS_OPTIONS.map(({ key, label, yesLabel, noLabel }) => (
        <div key={key}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {label}
          </label>
          <div className="flex flex-col gap-2">
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={key}
                  checked={values[key] === null}
                  onChange={() => onStatusChange(key, null)}
                  className="text-blue-600"
                />
                <span className="text-sm">Alle</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={key}
                  checked={values[key] === true}
                  onChange={() => onStatusChange(key, true)}
                  className="text-blue-600"
                />
                <span className="text-sm">{yesLabel}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={key}
                  checked={values[key] === false}
                  onChange={() => onStatusChange(key, false)}
                  className="text-blue-600"
                />
                <span className="text-sm">{noLabel}</span>
              </label>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
