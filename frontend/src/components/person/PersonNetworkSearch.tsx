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
            <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                    Finn forbindelse mellom to personer
                </h3>

                {/* Person A (pre-filled) */}
                <div className="mb-3">
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Person A</label>
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700">
                        <User className="h-4 w-4 text-blue-500" />
                        <span className="font-medium">{initialPersonA?.name ?? 'Ukjent'}</span>
                        {initialPersonA?.birthdate && (
                            <span className="text-gray-400 text-xs">({initialPersonA.birthdate})</span>
                        )}
                    </div>
                </div>

                {/* Person B (search) */}
                <div className="mb-4" ref={wrapperRef}>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Person B</label>
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
                            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />

                        {showDropdown && hasDropdownContent && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                                {isFetching ? (
                                    <div className="p-3 text-center text-gray-400 text-sm animate-pulse">Søker...</div>
                                ) : (
                                    searchResults?.map((person, idx) => (
                                        <button
                                            key={`${person.name}-${idx}`}
                                            onClick={() => handleSelectPerson(person.name, person.birthdate)}
                                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 text-left text-sm transition-colors"
                                        >
                                            <User className="h-3.5 w-3.5 text-gray-400" />
                                            <span className="font-medium text-gray-900">{person.name}</span>
                                            {person.birthdate && (
                                                <span className="text-gray-400 text-xs">({person.birthdate.slice(0, 4)})</span>
                                            )}
                                            <span className="ml-auto text-xs text-blue-600">
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
                    className="w-full py-2.5 px-4 bg-blue-900 text-white rounded-lg font-medium text-sm hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
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
                <div className="p-4 bg-red-50 rounded-xl border border-red-100 text-sm text-red-700">
                    Kunne ikke søke etter forbindelse. Prøv igjen senere.
                </div>
            )}
        </div>
    )
}
