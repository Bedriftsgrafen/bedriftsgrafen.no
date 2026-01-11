import React, { memo, useCallback } from 'react'
import { ArrowUpDown, ChevronDown } from 'lucide-react'
import { useFilterStore } from '../../store/filterStore'

/** Available sort options */
const SORT_OPTIONS = [
    { value: 'navn', label: 'Navn' },
    { value: 'revenue', label: 'Omsetning' },
    { value: 'profit', label: 'Resultat' },
    { value: 'antall_ansatte', label: 'Ansatte' },
    { value: 'stiftelsesdato', label: 'Stiftelsesdato' },
] as const

type SortField = typeof SORT_OPTIONS[number]['value']

/** Fields that default to descending order (numeric) */
const DESCENDING_DEFAULT_FIELDS: readonly string[] = ['revenue', 'profit', 'antall_ansatte']

/**
 * Sort selector dropdown for explorer results.
 * Integrates with filterStore for sort state management.
 */
export const SortSelect = memo(function SortSelect() {
    const sortBy = useFilterStore((s) => s.sortBy)
    const sortOrder = useFilterStore((s) => s.sortOrder)
    const setSort = useFilterStore((s) => s.setSort)

    // Handle sort field change
    const handleSortChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            const newField = e.target.value as SortField
            // Use sensible default order based on field type
            const defaultOrder = DESCENDING_DEFAULT_FIELDS.includes(newField) ? 'desc' : 'asc'
            setSort(newField, defaultOrder)
        },
        [setSort]
    )

    // Toggle sort order
    const toggleOrder = useCallback(() => {
        setSort(sortBy, sortOrder === 'asc' ? 'desc' : 'asc')
    }, [sortBy, sortOrder, setSort])

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 hidden sm:inline">Sorter:</span>

            {/* Sort field dropdown */}
            <div className="relative z-0">
                <select
                    value={sortBy}
                    onChange={handleSortChange}
                    className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-1.5 pr-8 text-sm font-medium text-gray-700 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none cursor-pointer"
                    aria-label="Sorteringsfelt"
                >
                    {SORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <ChevronDown
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none"
                    aria-hidden="true"
                />
            </div>

            {/* Sort order toggle */}
            <button
                type="button"
                onClick={toggleOrder}
                className="flex items-center gap-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors"
                aria-label={sortOrder === 'asc' ? 'Sorter stigende' : 'Sorter synkende'}
                title={sortOrder === 'asc' ? 'Stigende (A-Å, lavest først)' : 'Synkende (Å-A, høyest først)'}
            >
                <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">
                    {sortOrder === 'asc' ? '↑ Stigende' : '↓ Synkende'}
                </span>
            </button>
        </div>
    )
})
