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
                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none shadow-sm transition-all text-slate-900 placeholder-slate-400"
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />

                    {/* Quick-result dropdown */}
                    {showDropdown && hasDropdownContent && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                            <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hurtigresultater</span>
                                <button
                                    onClick={() => setShowDropdown(false)}
                                    className="text-[10px] text-slate-400 hover:text-slate-600 font-bold"
                                >
                                    LUKK
                                </button>
                            </div>
                            <div className="max-h-80 overflow-y-auto">
                                {previewLoading ? (
                                    <div className="p-4 text-center text-gray-500 animate-pulse text-sm">Søker...</div>
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
                                            className="flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 group/item"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-900 flex items-center justify-center group-hover/item:bg-blue-900 group-hover/item:text-white transition-colors">
                                                    <User className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-900">{person.name}</p>
                                                    {person.birthdate && (
                                                        <p className="text-[10px] text-slate-500 font-medium">Fødselsår: {person.birthdate.slice(0, 4)}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                                {person.role_count} {person.role_count === 1 ? 'rolle' : 'roller'}
                                            </span>
                                        </Link>
                                    ))
                                )}

                                {/* "See all results" footer */}
                                {!previewLoading && previewResults && previewResults.length > 0 && (
                                    <button
                                        onClick={handleAction}
                                        className="w-full px-4 py-3 border-t border-slate-100 flex items-center justify-center gap-2 text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors"
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
                        "hover:bg-blue-800 active:scale-95 transition-all text-sm flex items-center gap-2",
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
