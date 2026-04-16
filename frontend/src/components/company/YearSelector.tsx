import { useMemo, memo } from 'react'
import type { Accounting } from '../../types'

interface YearSelectorProps {
  accountings: Accounting[]
  selectedAccountingId: number | null
  onSelectAccounting: (year: number, accountingId: number) => void
}

/**
 * Format fiscal period label for display.
 * Shows "2023/2024" for non-calendar fiscal years, "2024" for calendar years.
 * Appends period range for split fiscal years (e.g. "2024 (jan–jun)").
 */
function formatPeriodLabel(accounting: Accounting, hasSiblings: boolean): string {
  if (!accounting.periode_fra || !accounting.periode_til) {
    return accounting.aar.toString()
  }

  const startYear = parseInt(accounting.periode_fra.slice(0, 4))
  const endYear = parseInt(accounting.periode_til.slice(0, 4))

  let base: string
  if (startYear !== endYear) {
    base = `${startYear}/${endYear}`
  } else {
    base = accounting.aar.toString()
  }

  // For split fiscal years, append month range to distinguish periods
  if (hasSiblings && accounting.periode_fra && accounting.periode_til) {
    const months = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
    const startMonth = parseInt(accounting.periode_fra.slice(5, 7)) - 1
    const endMonth = parseInt(accounting.periode_til.slice(5, 7)) - 1
    if (startMonth >= 0 && startMonth < 12 && endMonth >= 0 && endMonth < 12) {
      base += ` (${months[startMonth]}–${months[endMonth]})`
    }
  }

  return base
}

export const YearSelector = memo(
  function YearSelector({ accountings, selectedAccountingId, onSelectAccounting }: YearSelectorProps) {
    // Build a set of years that appear more than once (split fiscal years)
    const duplicateYears = useMemo(() => {
      const counts = new Map<number, number>()
      for (const a of accountings) {
        counts.set(a.aar, (counts.get(a.aar) || 0) + 1)
      }
      return new Set([...counts.entries()].filter(([, c]) => c > 1).map(([y]) => y))
    }, [accountings])

    const sortedAccountings = useMemo(
      () => [...accountings].sort((a, b) => {
        if (b.aar !== a.aar) return b.aar - a.aar
        // Within same year, sort by periode_til ascending so H1 comes before H2
        const aTil = a.periode_til || ''
        const bTil = b.periode_til || ''
        return aTil.localeCompare(bTil)
      }),
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
              key={accounting.id}
              onClick={() => onSelectAccounting(accounting.aar, accounting.id)}
              className={`px-4 py-2 rounded-lg border transition-colors ${selectedAccountingId === accounting.id
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                }`}
            >
              {formatPeriodLabel(accounting, duplicateYears.has(accounting.aar))}
            </button>
          ))}
        </div>
      </div>
    )
  },
  (prev, next) =>
    prev.selectedAccountingId === next.selectedAccountingId &&
    prev.accountings.length === next.accountings.length &&
    prev.onSelectAccounting === next.onSelectAccounting
)
