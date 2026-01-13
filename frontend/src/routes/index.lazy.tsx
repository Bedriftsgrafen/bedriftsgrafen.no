import { createLazyFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState, useCallback, type KeyboardEvent } from 'react'
import { StatisticsCards } from '../components/StatisticsCards'
import { ExplorerCTA } from '../components/ExplorerCTA'
import { FavoritesSection } from '../components/FavoritesSection'
import { RecentCompanies } from '../components/RecentCompanies'
import { RecentSearches } from '../components/RecentSearches'
import { SEOHead } from '../components/layout'
import { useUiStore } from '../store/uiStore'
import { useFilterStore } from '../store/filterStore'
import { Search, User, Building2 } from 'lucide-react'
import { usePersonSearchQuery } from '../hooks/queries/usePersonSearchQuery'

export const Route = createLazyFileRoute('/')(
    {
        component: HomePage,
    })

function HomePage() {
    const navigate = useNavigate()
    const [searchQuery, setSearchQuery] = useState('')
    const [committedPersonQuery, setCommittedPersonQuery] = useState('')
    const { addRecentSearch } = useUiStore()
    const { clearFilters } = useFilterStore()

    const [searchMode, setSearchMode] = useState<'company' | 'person'>('company')
    const {
        data: personResults,
        isLoading: personSearchLoading
    } = usePersonSearchQuery(committedPersonQuery)

    // Handle search - navigate to /utforsk with query param
    const handleSearch = useCallback((query: string) => {
        const trimmed = query.trim()
        if (!trimmed) return

        if (searchMode === 'person') {
            // Trigger the query for the dropdown
            setCommittedPersonQuery(trimmed)
            return
        }

        // Company search logic...
        // If 9-digit number, navigate directly to company page
        if (/^\d{9}$/.test(trimmed)) {
            navigate({ to: '/bedrift/$orgnr', params: { orgnr: trimmed } })
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

    // Reset committed query when switching modes or clearing input
    const handleModeChange = (mode: 'company' | 'person') => {
        setSearchMode(mode)
        setCommittedPersonQuery('')
        setSearchQuery('')
    }

    return (
        <>
            <SEOHead />

            <StatisticsCards />

            {/* Search section - navigates to /utforsk */}
            <section className="mb-4">
                <div className="search-gradient rounded-2xl shadow-xl p-8 text-white relative">
                    {/* Mode Toggle */}
                    <div className="flex items-center justify-center gap-2 mb-8 relative z-10">
                        <button
                            onClick={() => handleModeChange('company')}
                            className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold transition-all ${searchMode === 'company'
                                ? 'bg-white text-blue-900 shadow-lg scale-105'
                                : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                        >
                            <Building2 className="h-4 w-4" />
                            Bedrifter
                        </button>
                        <button
                            onClick={() => handleModeChange('person')}
                            className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold transition-all ${searchMode === 'person'
                                ? 'bg-white text-blue-900 shadow-lg scale-105'
                                : 'bg-white/10 text-white hover:bg-white/20'
                                }`}
                        >
                            <User className="h-4 w-4" />
                            Personer
                        </button>
                    </div>

                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 justify-center relative z-10">
                        {searchMode === 'company' ? (
                            <>
                                <Search className="h-6 w-6" />
                                Søk i norske virksomheter
                            </>
                        ) : (
                            <>
                                <Search className="h-6 w-6" />
                                Finn roller til personer
                            </>
                        )}
                    </h2>
                    <p className="text-white/90 text-center mb-6 relative z-10">
                        {searchMode === 'company'
                            ? 'Søk på bedriftsnavn, organisasjonsnummer, bransje eller sted'
                            : 'Søk etter navn på personer i styre og ledelse'}
                    </p>

                    <div className="max-w-2xl mx-auto relative z-20">
                        <div className="flex gap-3">
                            <div className="flex-1 relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value)
                                        // Clear committed query if user edits (hides old results)
                                        if (searchMode === 'person') setCommittedPersonQuery('')
                                    }}
                                    onKeyDown={handleKeyDown}
                                    placeholder={searchMode === 'company'
                                        ? "Søk etter bedrift, orgnr, bransje..."
                                        : "Søk etter navn på person..."}
                                    className="w-full px-4 py-3 bg-white border-0 rounded-lg focus:ring-2 focus:ring-blue-300 focus:outline-none text-blue-900 placeholder-blue-900/50 shadow-lg font-medium"
                                />
                                {searchMode === 'person' && committedPersonQuery && (
                                    <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-blue-100 overflow-hidden text-gray-900 z-50">
                                        {personSearchLoading ? (
                                            <div className="p-4 text-center text-gray-500 animate-pulse">Søker...</div>
                                        ) : personResults?.length === 0 ? (
                                            <div className="p-4 text-center text-gray-500 italic">Ingen personer funnet</div>
                                        ) : (
                                            <div className="max-h-64 overflow-y-auto">
                                                {personResults?.map((person, idx) => (
                                                    <Link
                                                        key={`${person.name}-${idx}`}
                                                        to="/person/$name/$birthdate"
                                                        params={{
                                                            name: person.name,
                                                            birthdate: person.birthdate || 'unknown'
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
                                                                    <div className="text-xs text-gray-500">Født: {person.birthdate}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                                            {person.role_count} {person.role_count === 1 ? 'rolle' : 'roller'}
                                                        </div>
                                                    </Link>
                                                ))}
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
