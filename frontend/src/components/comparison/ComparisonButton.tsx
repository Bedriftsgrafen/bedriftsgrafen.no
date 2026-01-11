import React, { memo, useCallback } from 'react'
import { Plus, Check } from 'lucide-react'
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
 * Shows + when not selected, ✓ when selected.
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
                className={`p-1 rounded transition-colors ${isSelected
                    ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                    : isMaxReached
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                    }`}
                title={isSelected ? 'Fjern fra sammenligning' : isMaxReached ? 'Maks 3 bedrifter' : 'Legg til sammenligning'}
            >
                {isSelected ? (
                    <Check className="h-4 w-4" />
                ) : (
                    <Plus className="h-4 w-4" />
                )}
            </button>
        )
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={isMaxReached}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-sm rounded-lg transition-colors ${isSelected
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                : isMaxReached
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            title={isSelected ? 'Fjern fra sammenligning' : isMaxReached ? 'Maks 3 bedrifter' : 'Legg til sammenligning'}
        >
            {isSelected ? (
                <>
                    <Check className="h-4 w-4" />
                    <span>Valgt</span>
                </>
            ) : (
                <>
                    <Plus className="h-4 w-4" />
                    <span>Sammenlign</span>
                </>
            )}
        </button>
    )
})
