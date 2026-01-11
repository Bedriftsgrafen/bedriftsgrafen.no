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
  // Display value adjusted for multiplier
  const displayMin = minValue !== null ? (minValue / multiplier).toString() : ''
  const displayMax = maxValue !== null ? (maxValue / multiplier).toString() : ''

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="number"
          step={step}
          placeholder={placeholder.min}
          value={displayMin}
          onChange={(e) => onChange(fieldName, true, e.target.value, multiplier)}
          className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />
        <input
          type="number"
          step={step}
          placeholder={placeholder.max}
          value={displayMax}
          onChange={(e) => onChange(fieldName, false, e.target.value, multiplier)}
          className="w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>
    </div>
  )
}
