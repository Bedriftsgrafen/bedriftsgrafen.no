import { useId } from 'react'

interface RangeInputProps {
  label: string
  minValue: number | null
  maxValue: number | null
  onChange: (field: string, isMin: boolean, value: string, multiplier?: number) => void
  fieldName: string
  multiplier?: number
  step?: string
  placeholder?: { min?: string; max?: string }
}

const RANGE_LABELS: Record<string, string> = {
  revenue: 'Omsetning',
  employee: 'Antall ansatte',
  profit: 'Resultat',
  equity: 'Egenkapital',
  operatingProfit: 'Driftsresultat',
  liquidityRatio: 'Likviditetsgrad',
  equityRatio: 'Egenkapitalandel',
}

/**
 * Reusable range input for min/max filters
 */
export function RangeInput({
  label,
  minValue,
  maxValue,
  onChange,
  fieldName,
  multiplier = 1,
  step,
  placeholder = { min: 'Min', max: 'Maks' }
}: RangeInputProps) {
  const minId = useId()
  const maxId = useId()
  // Display value adjusted for multiplier
  const displayMin = minValue !== null ? (minValue / multiplier).toString() : ''
  const displayMax = maxValue !== null ? (maxValue / multiplier).toString() : ''
  const accessibleLabel = label || RANGE_LABELS[fieldName] || fieldName

  return (
    <div>
      {label && (
        <span className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </span>
      )}
      <div className="flex gap-2">
        <input
          id={minId}
          type="number"
          step={step}
          placeholder={placeholder.min}
          value={displayMin}
          onChange={(e) => onChange(fieldName, true, e.target.value, multiplier)}
          className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          aria-label={`${accessibleLabel}: minimum`}
        />
        <input
          id={maxId}
          type="number"
          step={step}
          placeholder={placeholder.max}
          value={displayMax}
          onChange={(e) => onChange(fieldName, false, e.target.value, multiplier)}
          className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          aria-label={`${accessibleLabel}: maksimum`}
        />
      </div>
    </div>
  )
}
