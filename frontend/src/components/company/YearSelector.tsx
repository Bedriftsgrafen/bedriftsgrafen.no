import { useMemo, memo } from 'react'
import type { Accounting } from '../../types'

interface YearSelectorProps {
  accountings: Accounting[]
  selectedYear: number | null
  onSelectYear: (year: number) => void
}

/**
 * Format fiscal period label for display.
 * Shows "2023/2024" for non-calendar fiscal years, "2024" for calendar years.
 * Defined outside component to avoid recreation on each render.
 */
function formatPeriodLabel(accounting: Accounting): string {
  if (!accounting.periode_fra || !accounting.periode_til) {
    return accounting.aar.toString()
  }

  const startYear = parseInt(accounting.periode_fra.slice(0, 4))
  const endYear = parseInt(accounting.periode_til.slice(0, 4))

  // Non-calendar fiscal year spans two years
  if (startYear !== endYear) {
    return `${startYear}/${endYear}`
  }

  return accounting.aar.toString()
}

export const YearSelector = memo(
  function YearSelector({ accountings, selectedYear, onSelectYear }: YearSelectorProps) {
    // Memoize sorted accountings to prevent re-sorting on every render
    const sortedAccountings = useMemo(
      () => [...accountings].sort((a, b) => b.aar - a.aar),
      [accountings]
    )

    return (
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Velg regnskapsperiode
        </label>
        <div className="flex gap-2 flex-wrap">
          {sortedAccountings.map((accounting) => (
            <button
              key={accounting.aar}
              onClick={() => onSelectYear(accounting.aar)}
              className={`px-4 py-2 rounded-lg border transition-colors ${selectedYear === accounting.aar
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                }`}
            >
              {formatPeriodLabel(accounting)}
            </button>
          ))}
        </div>
      </div>
    )
  },
  (prev, next) =>
    prev.selectedYear === next.selectedYear &&
    prev.accountings.length === next.accountings.length &&
    prev.onSelectYear === next.onSelectYear
)
