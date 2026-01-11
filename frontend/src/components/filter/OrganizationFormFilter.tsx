import type { OrganizationFormOption } from '../../types'

interface OrganizationFormFilterProps {
  selectedForms: string[]
  options: OrganizationFormOption[]
  onToggle: (value: string) => void
  onSelectAll?: () => void
  onClearAll?: () => void
}

export function OrganizationFormFilter({
  selectedForms,
  options,
  onToggle,
  onSelectAll,
  onClearAll
}: OrganizationFormFilterProps) {
  const allSelected = selectedForms.length === options.length
  const noneSelected = selectedForms.length === 0

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          Organisasjonsform
        </label>
        <div className="flex gap-2">
          {!allSelected && onSelectAll && (
            <button
              type="button"
              onClick={onSelectAll}
              className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              Velg alle
            </button>
          )}
          {!noneSelected && onClearAll && (
            <button
              type="button"
              onClick={onClearAll}
              className="text-xs text-gray-500 hover:text-gray-700 hover:underline"
            >
              Fjern alle
            </button>
          )}
        </div>
      </div>
      <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-100 rounded p-2">
        {options.map((form) => (
          <label
            key={form.value}
            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
          >
            <input
              type="checkbox"
              checked={selectedForms.includes(form.value)}
              onChange={() => onToggle(form.value)}
              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">{form.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}
