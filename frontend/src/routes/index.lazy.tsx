/* eslint-disable react-refresh/only-export-components */
import { createLazyFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState, useCallback, useEffect, type KeyboardEvent } from 'react'
import { StatisticsCards } from '../components/StatisticsCards'
import { ExplorerCTA } from '../components/ExplorerCTA'
import { FavoritesSection } from '../components/FavoritesSection'
import { RecentCompanies } from '../components/RecentCompanies'
import { RecentSearches } from '../components/RecentSearches'
import { SEOHead } from '../components/layout'
import { useUiStore } from '../store/uiStore'
import { useFilterStore } from '../store/filterStore'
import { Search, User, Building2, ArrowRight } from 'lucide-react'
import { usePersonSearchQuery } from '../hooks/queries/usePersonSearchQuery'

export const Route = createLazyFileRoute('/')(
    {
        component: HomePage,
    })

export function HomePage() {
    const navigate = useNavigate()
    const [searchQuery, setSearchQuery] = useState('')
    const [debouncedPersonQuery, setDebouncedPersonQuery] = useState('')
    const addRecentSearch = useUiStore(s => s.addRecentSearch)
    const clearFilters = useFilterStore(s => s.clearFilters)

    const [searchMode, setSearchMode] = useState<'company' | 'person'>('company')
    const {
        data: personResults,
        isFetching: personSearchLoading
    } = usePersonSearchQuery(debouncedPersonQuery, 5)

    // Debounce person search for dropdown preview
    useEffect(() => {
        if (searchMode !== 'person' || searchQuery.length < 3) {
            // eslint-disable-next-line @eslint-react/set-state-in-effect
            setDebouncedPersonQuery('')
            return
        }
        const timer = setTimeout(() => setDebouncedPersonQuery(searchQuery), 300)
        return () => clearTimeout(timer)
    }, [searchQuery, searchMode])

    // Handle search - navigate to /utforsk with query param
    const handleSearch = useCallback((query: string) => {
        const trimmed = query.trim()
        if (!trimmed) return

        if (searchMode === 'person') {
            // Navigate to person search results page
            navigate({ to: '/personer', search: { q: trimmed } })
            return
        }

        // Company search logic...
        // If 9-digit number, navigate directly to company page
        if (/^\d{9}$/.test(trimmed)) {
            navigate({ to: '/virksomhet/$orgnr', params: { orgnr: trimmed } })
            return
        }

        // Clear all filters before searching (prevents stale filters from map/bransje)
        clearFilters()

        // Navigate to utforsk with search query
        addRecentSearch(trimmed)
        navigate({ to: '/utforsk', search: { q: trimmed } })
    }, [navigate, addRecentSearch, clearFilters, searchMode])

    const handleKeyDown = (e: KeyboardEvent<Element>) => {
        if (e.key === 'Enter') {
            handleSearch(searchQuery)
        }
    }

    // Reset query when switching modes or clearing input
    const handleModeChange = (mode: 'company' | 'person') => {
        setSearchMode(mode)
        setDebouncedPersonQuery('')
        setSearchQuery('')
    }

    return (
        <>
            <SEOHead />

            <StatisticsCards />

            {/* Search section - navigates to /utforsk */}
            <section className="mb-4">
                <div className="search-gradient rounded-2xl shadow-xl p-6 text-white relative">
                    {/* Mode Toggle - sliding switch */}
                    <div className="flex items-center justify-center mb-4 relative z-10">
                        <div className="relative flex bg-white/15 rounded-full p-1">
                            {/* Sliding indicator */}
                            <div
                                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-full shadow-lg transition-transform duration-300 ease-in-out ${
                                    searchMode === 'person' ? 'translate-x-[calc(100%+8px)]' : 'translate-x-0'
                                }`}
                            />
                            <button
                                id="search-mode-company"
                                onClick={() => handleModeChange('company')}
                                className={`relative z-10 flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm transition-colors duration-300 ${
                                    searchMode === 'company' ? 'text-blue-900' : 'text-white/80 hover:text-white'
                                }`}
                            >
                                <Building2 className="h-4 w-4" />
                                Virksomheter
                            </button>
                            <button
                                id="search-mode-person"
                                onClick={() => handleModeChange('person')}
                                className={`relative z-10 flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm transition-colors duration-300 ${
                                    searchMode === 'person' ? 'text-blue-900' : 'text-white/80 hover:text-white'
                                }`}
                            >
                                <User className="h-4 w-4" />
                                Personer
                            </button>
                        </div>
                    </div>

                    <div className="max-w-2xl mx-auto relative z-20">
                        <div className="flex gap-3">
                            <div className="flex-1 relative">
                                <input
                                    id="home-search-input"
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value)
                                    }}
                                    onKeyDown={handleKeyDown}
                                    placeholder={searchMode === 'company'
                                        ? "Søk etter virksomhet, orgnr, bransje eller formål..."
                                        : "Søk etter navn på person..."}
                                    className="w-full px-4 py-3 bg-white border-0 rounded-lg focus:ring-2 focus:ring-blue-300 focus:outline-none text-blue-900 placeholder-blue-900/50 shadow-lg font-medium"
                                />
                                {searchMode === 'person' && debouncedPersonQuery && (personSearchLoading || (personResults && personResults.length > 0)) && (
                                    <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-blue-100 overflow-hidden text-gray-900 z-50">
                                        {personSearchLoading ? (
                                            <div className="p-4 text-center text-gray-500 animate-pulse">Søker...</div>
                                        ) : (
                                            <div className="max-h-64 overflow-y-auto">
                                                {personResults?.map((person, idx) => (
                                                    <Link
                                                        key={`${person.name}-${idx}`}
                                                        to="/person/$name/$birthdate"
                                                        params={{
                                                            name: person.name,
                                                            birthdate: person.birthdate ? person.birthdate.slice(0, 4) : 'unknown'
                                                        }}
                                                        className="flex items-center justify-between p-4 hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 group"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-blue-100 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                                <User className="h-4 w-4" />
                                                            </div>
                                                            <div>
                                                                <div className="font-bold">{person.name}</div>
                                                                {person.birthdate && (
                                                                    <div className="text-xs text-gray-500">Fødselsår: {person.birthdate.slice(0, 4)}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                                            {person.role_count} {person.role_count === 1 ? 'rolle' : 'roller'}
                                                        </div>
                                                    </Link>
                                                ))}
                                                <Link
                                                    to="/personer"
                                                    search={{ q: searchQuery.trim() }}
                                                    className="flex items-center justify-center gap-2 p-3 border-t border-gray-100 text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors"
                                                >
                                                    Se alle resultater
                                                    <ArrowRight className="h-4 w-4" />
                                                </Link>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => handleSearch(searchQuery)}
                                className="px-6 py-3 bg-white text-blue-900 font-bold rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2 shadow-lg"
                            >
                                <Search className="h-4 w-4" />
                                Søk
                            </button>
                        </div>
                    </div>

                    {searchMode === 'company' && (
                        <div className="mt-4 flex flex-wrap gap-2 justify-center text-xs text-white/70 relative z-10 animate-in fade-in slide-in-from-top-1">
                            <span className="font-semibold text-white/90">Tips:</span>
                            <span>Prøv å søke etter formål som</span>
                            <button onClick={() => { setSearchQuery('Equinor'); handleSearch('Equinor'); }} className="underline hover:text-white transition-colors">"Equinor"</button>,
                            <button onClick={() => { setSearchQuery('ai'); handleSearch('ai'); }} className="underline hover:text-white transition-colors">"ai"</button>
                            <span>eller</span>
                            <button onClick={() => { setSearchQuery('993144169 '); handleSearch('993144169'); }} className="underline hover:text-white transition-colors">"993144169"</button>
                        </div>
                    )}
                </div>
            </section>

            <RecentSearches
                onSelectSearch={(q) => {
                    setSearchQuery(q)
                    handleSearch(q)
                }}
            />

            <ExplorerCTA />

            <FavoritesSection />

            <RecentCompanies />
        </>
    )
}
