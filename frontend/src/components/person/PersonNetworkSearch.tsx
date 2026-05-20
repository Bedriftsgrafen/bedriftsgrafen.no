import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Loader2, User } from 'lucide-react'
import { usePersonSearchQuery } from '../../hooks/queries/usePersonSearchQuery'
import { useNetworkPathMutation } from '../../hooks/queries/useNetworkPathQuery'
import { NetworkPathResult } from './NetworkPathResult'

interface PersonNetworkSearchProps {
    /** Pre-fill Person A with current person's details */
    initialPersonA?: { name: string; birthdate: string | null }
}

/**
 * Two-person search UI for finding shortest path between two people
 * via shared board memberships. Person A is pre-filled with the current person.
 */
export function PersonNetworkSearch({ initialPersonA }: PersonNetworkSearchProps) {
    const [personBQuery, setPersonBQuery] = useState('')
    const [debouncedQuery, setDebouncedQuery] = useState('')
    const [showDropdown, setShowDropdown] = useState(false)
    const [selectedPersonB, setSelectedPersonB] = useState<{ name: string; birthdate: string | null } | null>(null)
    const wrapperRef = useRef<HTMLDivElement>(null)

    const { data: searchResults, isFetching } = usePersonSearchQuery(debouncedQuery, 5)
    const mutation = useNetworkPathMutation()

    // Debounce
    useEffect(() => {
        if (personBQuery.length < 3) {
            // eslint-disable-next-line @eslint-react/set-state-in-effect
            setDebouncedQuery('')
            return
        }
        const timer = setTimeout(() => setDebouncedQuery(personBQuery), 300)
        return () => clearTimeout(timer)
    }, [personBQuery])

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleSelectPerson = useCallback((name: string, birthdate: string | null) => {
        setSelectedPersonB({ name, birthdate })
        setPersonBQuery(name)
        setShowDropdown(false)
    }, [])

    const handleSearch = useCallback(() => {
        if (!initialPersonA || !selectedPersonB) return
        mutation.mutate({
            person_a_name: initialPersonA.name,
            person_a_birthdate: initialPersonA.birthdate,
            person_b_name: selectedPersonB.name,
            person_b_birthdate: selectedPersonB.birthdate,
            max_depth: 3,
        })
    }, [initialPersonA, selectedPersonB, mutation])

    const hasDropdownContent = debouncedQuery.length >= 3 && (isFetching || (searchResults && searchResults.length > 0))

    return (
        <div className="space-y-6">
            <div className="rounded-xl bg-gray-50 p-5 dark:border dark:border-slate-800 dark:bg-slate-950">
                <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400">
                    Finn forbindelse mellom to personer
                </h3>

                {/* Person A (pre-filled) */}
                <div className="mb-3">
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">Person A</label>
                    <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                        <User className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">{initialPersonA?.name ?? 'Ukjent'}</span>
                        {initialPersonA?.birthdate && (
                            <span className="text-xs text-gray-400 dark:text-slate-500">({initialPersonA.birthdate})</span>
                        )}
                    </div>
                </div>

                {/* Person B (search) */}
                <div className="mb-4" ref={wrapperRef}>
                    <label className="mb-1 block text-xs font-medium text-gray-500 dark:text-slate-400">Person B</label>
                    <div className="relative">
                        <input
                            type="text"
                            value={personBQuery}
                            onChange={(e) => {
                                setPersonBQuery(e.target.value)
                                setSelectedPersonB(null)
                                setShowDropdown(true)
                            }}
                            onFocus={() => setShowDropdown(true)}
                            placeholder="Søk etter person..."
                            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/15"
                        />
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500" />

                        {showDropdown && hasDropdownContent && (
                            <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40">
                                {isFetching ? (
                                    <div className="animate-pulse p-3 text-center text-sm text-gray-400 dark:text-slate-400">Søker...</div>
                                ) : (
                                    searchResults?.map((person, idx) => (
                                        <button
                                            key={`${person.name}-${idx}`}
                                            onClick={() => handleSelectPerson(person.name, person.birthdate)}
                                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-blue-50 dark:hover:bg-white/5"
                                        >
                                            <User className="h-3.5 w-3.5 text-gray-400 dark:text-slate-500" />
                                            <span className="font-medium text-gray-900 dark:text-white">{person.name}</span>
                                            {person.birthdate && (
                                                <span className="text-xs text-gray-400 dark:text-slate-500">({person.birthdate.slice(0, 4)})</span>
                                            )}
                                            <span className="ml-auto text-xs text-blue-600 dark:text-blue-300">
                                                {person.role_count} roller
                                            </span>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={handleSearch}
                    disabled={!selectedPersonB || mutation.isPending}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400"
                >
                    {mutation.isPending ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Søker forbindelser...
                        </>
                    ) : (
                        <>
                            <Search className="h-4 w-4" />
                            Finn forbindelse
                        </>
                    )}
                </button>
            </div>

            {/* Results */}
            {mutation.data && (
                <NetworkPathResult result={mutation.data} />
            )}

            {mutation.isError && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-200">
                    Kunne ikke søke etter forbindelse. Prøv igjen senere.
                </div>
            )}
        </div>
    )
}
