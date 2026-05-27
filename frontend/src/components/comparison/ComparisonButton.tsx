import React, { memo, useCallback } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { useComparisonStore } from '../../store/comparisonStore'

/** Props for ComparisonButton */
interface ComparisonButtonProps {
    orgnr: string
    navn: string
    /** Optional compact mode for table rows */
    compact?: boolean
}

/**
 * Button to add/remove a company from comparison.
 */
export const ComparisonButton = memo(function ComparisonButton({
    orgnr,
    navn,
    compact = false,
}: ComparisonButtonProps) {
    const isSelected = useComparisonStore((s) => s.isSelected(orgnr))
    const companies = useComparisonStore((s) => s.companies)
    const addCompany = useComparisonStore((s) => s.addCompany)
    const removeCompany = useComparisonStore((s) => s.removeCompany)

    const isMaxReached = companies.length >= 3 && !isSelected

    const handleClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation() // Prevent row click
        if (isSelected) {
            removeCompany(orgnr)
        } else if (!isMaxReached) {
            addCompany({ orgnr, navn })
        }
    }, [orgnr, navn, isSelected, isMaxReached, addCompany, removeCompany])

    if (compact) {
        return (
            <button
                type="button"
                onClick={handleClick}
                disabled={isMaxReached}
                aria-label={isSelected ? 'Fjern fra sammenligning' : isMaxReached ? 'Maks 3 virksomheter' : 'Legg til sammenligning'}
                aria-pressed={isSelected}
                className={`rounded p-1 transition-colors ${isSelected
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:hover:bg-blue-500/20'
                    : isMaxReached
                        ? 'cursor-not-allowed text-gray-400 dark:text-slate-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-blue-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-blue-300'
                    }`}
                title={isSelected ? 'Fjern fra sammenligning' : isMaxReached ? 'Maks 3 virksomheter' : 'Legg til sammenligning'}
            >
                <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
            </button>
        )
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={isMaxReached}
            aria-pressed={isSelected}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${isSelected
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-500/15 dark:text-blue-200 dark:hover:bg-blue-500/20'
                : isMaxReached
                    ? 'cursor-not-allowed bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-slate-600'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
            title={isSelected ? 'Fjern fra sammenligning' : isMaxReached ? 'Maks 3 virksomheter' : 'Legg til sammenligning'}
        >
            {isSelected ? (
                <>
                    <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                    <span>Valgt</span>
                </>
            ) : (
                <>
                    <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                    <span>Sammenlign</span>
                </>
            )}
        </button>
    )
})
