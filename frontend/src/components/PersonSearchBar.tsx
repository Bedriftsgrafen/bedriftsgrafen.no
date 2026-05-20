import { useState, useEffect, useCallback, useRef, type KeyboardEvent } from 'react'
import { Link } from '@tanstack/react-router'
import { Search, User, ArrowRight } from 'lucide-react'
import clsx from 'clsx'
import { usePersonSearchQuery } from '../hooks/queries/usePersonSearchQuery'

interface PersonSearchBarProps {
    initialValue: string
    onSearch: (query: string) => void
    isLoading?: boolean
}

/**
 * Action-triggered search bar for the person search results page.
 * Shows a quick-result dropdown (top 5) while typing, but the full
 * paginated search only fires on Enter/button click.
 */
export function PersonSearchBar({ initialValue, onSearch, isLoading = false }: PersonSearchBarProps) {
    const [localValue, setLocalValue] = useState(initialValue)
    const [debouncedValue, setDebouncedValue] = useState('')
    const [showDropdown, setShowDropdown] = useState(false)
    const wrapperRef = useRef<HTMLDivElement>(null)

    // Sync from parent when URL search param changes
    useEffect(() => {
        // eslint-disable-next-line @eslint-react/set-state-in-effect
        setLocalValue(initialValue)
    }, [initialValue])

    // Debounce local value for dropdown preview
    useEffect(() => {
        if (localValue.length < 3) {
            // eslint-disable-next-line @eslint-react/set-state-in-effect
            setDebouncedValue('')
            return
        }
        const timer = setTimeout(() => setDebouncedValue(localValue), 300)
        return () => clearTimeout(timer)
    }, [localValue])

    // Quick preview: top 5 results from lightweight endpoint
    const { data: previewResults, isFetching: previewLoading } = usePersonSearchQuery(debouncedValue, 5)

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

    const handleAction = useCallback(() => {
        setShowDropdown(false)
        const trimmed = localValue.trim()
        if (trimmed) onSearch(trimmed)
    }, [onSearch, localValue])

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleAction()
        } else if (e.key === 'Escape') {
            setShowDropdown(false)
        }
    }

    const hasDropdownContent = debouncedValue.length >= 3 && (previewLoading || (previewResults && previewResults.length > 0))

    return (
        <div ref={wrapperRef} className="relative w-full group">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={localValue}
                        onChange={(e) => {
                            setLocalValue(e.target.value)
                            setShowDropdown(true)
                        }}
                        onFocus={() => setShowDropdown(true)}
                        onKeyDown={handleKeyDown}
                        placeholder="Søk etter navn på person..."
                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/15"
                    />
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500 dark:text-slate-500 dark:group-focus-within:text-blue-300" />

                    {/* Quick-result dropdown */}
                    {showDropdown && hasDropdownContent && (
                        <div className="animate-in fade-in slide-in-from-top-2 absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40">
                            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Hurtigresultater</span>
                                <button
                                    onClick={() => setShowDropdown(false)}
                                    className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                                >
                                    LUKK
                                </button>
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                                {previewLoading ? (
                                    <div className="animate-pulse p-4 text-center text-sm text-gray-500 dark:text-slate-400">Søker...</div>
                                ) : (
                                    previewResults?.map((person, idx) => (
                                        <Link
                                            key={`${person.name}-${idx}`}
                                            to="/person/$name/$birthdate"
                                            params={{
                                                name: person.name,
                                                birthdate: person.birthdate ? person.birthdate.slice(0, 4) : 'unknown'
                                            }}
                                            onClick={() => setShowDropdown(false)}
                                            className="group/item flex items-center justify-between border-b border-gray-50 px-4 py-3 transition-colors last:border-0 hover:bg-blue-50 dark:border-slate-800 dark:hover:bg-white/5"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-900 transition-colors group-hover/item:bg-blue-900 group-hover/item:text-white dark:bg-blue-500/15 dark:text-blue-200 dark:group-hover/item:bg-blue-500 dark:group-hover/item:text-slate-950">
                                                    <User className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{person.name}</p>
                                                    {person.birthdate && (
                                                        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Fødselsår: {person.birthdate.slice(0, 4)}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-600 dark:bg-blue-500/15 dark:text-blue-200">
                                                {person.role_count} {person.role_count === 1 ? 'rolle' : 'roller'}
                                            </span>
                                        </Link>
                                    ))
                                )}

                                {/* "See all results" footer */}
                                {!previewLoading && previewResults && previewResults.length > 0 && (
                                    <button
                                        onClick={handleAction}
                                        className="flex w-full items-center justify-center gap-2 border-t border-slate-100 px-4 py-3 text-sm font-bold text-blue-600 transition-colors hover:bg-blue-50 dark:border-slate-800 dark:text-blue-300 dark:hover:bg-white/5"
                                    >
                                        Se alle resultater
                                        <ArrowRight className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleAction}
                    disabled={isLoading}
                    className={clsx(
                        "px-6 py-3 bg-blue-900 text-white rounded-xl font-bold shadow-lg shadow-blue-950/20",
                        "hover:bg-blue-800 active:scale-95 transition-all text-sm flex items-center gap-2 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400",
                        "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                    )}
                >
                    {isLoading ? (
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Search className="h-4 w-4" />
                    )}
                    Søk
                </button>
            </div>
        </div>
    )
}
