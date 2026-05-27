import { useMemo, memo } from 'react'
import type { Accounting } from '../../types'
import {
  formatAccountingPeriodRange,
  getDisplayAccountings,
  shouldShowAccountingPeriod,
} from '../../utils/accountingHelpers'

interface YearSelectorProps {
  accountings: Accounting[]
  selectedAccountingId: number | null
  onSelectAccounting: (year: number, accountingId: number) => void
}

interface PeriodLabel {
  primary: string
  secondary: string | null
  ariaLabel: string
}

function formatPeriodLabel(accounting: Accounting, hasSiblings: boolean): PeriodLabel {
  const primary = accounting.aar.toString()

  if (!shouldShowAccountingPeriod(accounting, hasSiblings)) {
    return {
      primary,
      secondary: null,
      ariaLabel: `Regnskapsår ${primary}`,
    }
  }

  const period = formatAccountingPeriodRange(accounting)

  if (!period) {
    return {
      primary,
      secondary: null,
      ariaLabel: `Regnskapsår ${primary}`,
    }
  }

  return {
    primary,
    secondary: period,
    ariaLabel: `Regnskapsår ${primary}, periode ${period.replace(' - ', ' til ')}`,
  }
}

export const YearSelector = memo(
  function YearSelector({ accountings, selectedAccountingId, onSelectAccounting }: YearSelectorProps) {
    const sortedAccountings = useMemo(
      () => getDisplayAccountings(accountings),
      [accountings]
    )

    // Build a set of years that appear more than once (split fiscal years)
    const duplicateYears = useMemo(() => {
      const counts = new Map<number, number>()
      for (const a of sortedAccountings) {
        counts.set(a.aar, (counts.get(a.aar) || 0) + 1)
      }
      return new Set([...counts.entries()].filter(([, c]) => c > 1).map(([y]) => y))
    }, [sortedAccountings])

    return (
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Velg regnskapsår
        </label>
        <div className="flex gap-2 flex-wrap">
          {sortedAccountings.map((accounting) => {
            const label = formatPeriodLabel(accounting, duplicateYears.has(accounting.aar))
            const isSelected = selectedAccountingId === accounting.id

            return (
              <button
                key={accounting.id}
                onClick={() => onSelectAccounting(accounting.aar, accounting.id)}
                aria-label={label.ariaLabel}
                title={label.ariaLabel}
                className={`min-h-13 min-w-20 rounded-lg border px-3 py-2 text-center leading-tight transition-colors ${isSelected
                  ? 'bg-blue-900 text-white border-blue-900'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                  }`}
              >
                <span className="block text-sm font-semibold leading-tight">{label.primary}</span>
                {label.secondary && (
                  <span className={`mt-0.5 block text-xs leading-tight ${isSelected ? 'text-blue-100' : 'text-gray-500'}`}>
                    {label.secondary}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    )
  },
  (prev, next) =>
    prev.selectedAccountingId === next.selectedAccountingId &&
    prev.accountings.length === next.accountings.length &&
    prev.onSelectAccounting === next.onSelectAccounting
)
