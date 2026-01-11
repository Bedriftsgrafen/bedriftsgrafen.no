import { createLazyFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useCallback, type KeyboardEvent } from 'react'
import { StatisticsCards } from '../components/StatisticsCards'
import { ExplorerCTA } from '../components/ExplorerCTA'
import { FavoritesSection } from '../components/FavoritesSection'
import { RecentCompanies } from '../components/RecentCompanies'
import { RecentSearches } from '../components/RecentSearches'
import { SEOHead } from '../components/layout'
import { useUiStore } from '../store/uiStore'
import { useFilterStore } from '../store/filterStore'
import { Search } from 'lucide-react'

export const Route = createLazyFileRoute('/')(
    {
        component: HomePage,
    })

function HomePage() {
    const navigate = useNavigate()
    const [searchQuery, setSearchQuery] = useState('')
    const { addRecentSearch } = useUiStore()
    const { clearFilters } = useFilterStore()

    // Handle search - navigate to /utforsk with query param
    const handleSearch = useCallback((query: string) => {
        const trimmed = query.trim()
        if (!trimmed) return

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
    }, [navigate, addRecentSearch, clearFilters])

    const handleKeyDown = (e: KeyboardEvent<Element>) => {
        if (e.key === 'Enter') {
            handleSearch(searchQuery)
        }
    }

    return (
        <>
            <SEOHead />

            <StatisticsCards />

            {/* Search section - navigates to /utforsk */}
            <section className="mb-4">
                <div className="search-gradient rounded-2xl shadow-xl p-8 text-white overflow-hidden">
                    <h2 className="text-2xl font-bold mb-2 flex items-center gap-2 justify-center relative z-10">
                        <Search className="h-6 w-6" />
                        Søk i norske virksomheter
                    </h2>
                    <p className="text-white/90 text-center mb-6 relative z-10">
                        Søk på bedriftsnavn, organisasjonsnummer, bransje eller sted
                    </p>
                    <div className="flex gap-3 max-w-2xl mx-auto relative z-10">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Søk etter bedrift, orgnr, bransje..."
                            className="flex-1 px-4 py-3 bg-white border-0 rounded-lg focus:ring-2 focus:ring-blue-300 focus:outline-none text-blue-900 placeholder-blue-900/50 shadow-lg font-medium"
                        />
                        <button
                            onClick={() => handleSearch(searchQuery)}
                            className="px-6 py-3 bg-white text-blue-900 font-bold rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2 shadow-lg"
                        >
                            <Search className="h-4 w-4" />
                            Søk
                        </button>
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
