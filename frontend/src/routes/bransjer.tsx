import { createFileRoute, useSearch, useNavigate } from '@tanstack/react-router'
import { ExplorerLayout } from '../components/explorer'
import { SEOHead } from '../components/layout'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { IndustryDashboard } from '../components/dashboard/IndustryDashboard'
import { IndustryMap } from '../components/maps/IndustryMap'
import { CompanyModalOverlay } from '../components/company/CompanyModalOverlay'
import { useMemo, useCallback } from 'react'
import { BarChart3, Search, Map } from 'lucide-react'
import { TabButton } from '../components/common'
import { z } from 'zod'
import { NACE_CODES, NACE_DIVISIONS } from '../constants/explorer'

// Tab type for type safety
type BransjerTab = 'stats' | 'search' | 'map'

// Search params schema - now includes tab for state persistence
const searchSchema = z.object({
    nace: z.string().optional(),
    tab: z.enum(['stats', 'search', 'map']).optional(),
    orgnr: z.string().optional(),
})

export const Route = createFileRoute('/bransjer')({
    validateSearch: searchSchema,
    component: BransjerPage,
})

function BransjerPage() {
    useDocumentTitle('Utforsk bransjer | Bedriftsgrafen.no')
    const navigate = useNavigate()
    const { nace, tab, orgnr } = useSearch({ from: '/bransjer' })

    // Tab state persisted in URL - defaults to 'stats' unless mapFilter is present at mount
    const activeTab: BransjerTab = useMemo(() => {
        if (tab) return tab
        // Only check sessionStorage as fallback when tab param is not set
        if (typeof window !== 'undefined' && sessionStorage.getItem('mapFilter')) {
            return 'search'
        }
        return 'stats'
    }, [tab])

    // Change tab by updating URL search params (preserves state on navigation)
    const setActiveTab = useCallback((newTab: BransjerTab) => {
        navigate({
            to: '/bransjer',
            search: (prev) => ({ ...prev, tab: newTab }),
            replace: true, // Don't create history entry for tab changes
        })
    }, [navigate])

    const [selectedNaceForMap, setSelectedNaceForMap] = useMemo(() => {
        return [nace || null, (value: string | null) => {
            navigate({
                to: '/bransjer',
                search: (prev) => ({ ...prev, nace: value ?? undefined }),
                replace: true,
            })
        }]
    }, [nace, navigate])

    // Company modal overlay state (for map markers and search results) - read from URL
    const selectedCompanyOrgnr = orgnr ?? null

    const setSelectedCompanyOrgnr = useCallback((orgnr: string | null) => {
        navigate({
            to: '/bransjer',
            search: (prev) => ({ ...prev, orgnr: orgnr ?? undefined }),
            replace: true,
        })
    }, [navigate])

    // Handle search click from map - switch to search tab and store filter
    const handleMapSearchClick = (regionName: string, regionCode: string, naceCode: string | null) => {
        // Extract just the Norwegian name (remove Sami name if present, e.g., "Nordland - Nordlánnda" -> "Nordland")
        const cleanName = regionName.split(' - ')[0].trim();

        // Determine if it's a county (2 digits) or municipality (4 digits)
        const isCounty = regionCode.length === 2;

        // Store filter for ExplorerLayout to pick up
        sessionStorage.setItem('mapFilter', JSON.stringify({
            // Use county code for counties, municipality name for municipalities
            county: isCounty ? regionCode : '',
            municipality: isCounty ? '' : cleanName,
            nace: naceCode,
        }));
        // Switch to search tab
        setActiveTab('search');
    };

    // Flatten all NACE divisions into a sorted list
    const allNaceDivisions = useMemo(() => {
        const divisions: { code: string; name: string; section: string }[] = []
        for (const section of NACE_CODES) {
            const sectionDivisions = NACE_DIVISIONS[section.code] || []
            for (const div of sectionDivisions) {
                divisions.push({
                    code: div.code,
                    name: div.name,
                    section: section.code,
                })
            }
        }
        // Sort by code numerically
        return divisions.sort((a, b) => parseInt(a.code) - parseInt(b.code))
    }, [])

    return (
        <>
            <SEOHead
                title="Utforsk bransjer | Bedriftsgrafen.no"
                description="Utforsk norske bedrifter etter bransje, region og selskapsform. Filtrer på omsetning, antall ansatte og mer."
            />

            {/* Page header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-black mb-2">
                    Utforsk bransjer
                </h1>
                <p className="text-gray-700 text-lg">
                    Finn og analyser bedrifter etter bransje, område og finansielle kriterier.
                </p>
            </div>

            {/* Tab navigation */}
            <div className="flex gap-2 mb-6 border-b border-gray-200">
                <TabButton
                    active={activeTab === 'stats'}
                    icon={<BarChart3 size={18} />}
                    label="Bransjestatistikk"
                    onClick={() => setActiveTab('stats')}
                />
                <TabButton
                    active={activeTab === 'map'}
                    icon={<Map size={18} />}
                    label="Bransjekart"
                    onClick={() => setActiveTab('map')}
                />
                <TabButton
                    active={activeTab === 'search'}
                    icon={<Search size={18} />}
                    label="Søk bedrifter"
                    onClick={() => setActiveTab('search')}
                />
            </div>

            {/* Content */}
            {activeTab === 'stats' && <IndustryDashboard initialNace={nace} />}
            {activeTab === 'map' && (
                <div className="space-y-4">
                    {/* NACE selector for map */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Filtrer kart etter bransje
                        </label>
                        <select
                            value={selectedNaceForMap || ''}
                            onChange={(e) => setSelectedNaceForMap(e.target.value || null)}
                            className="block w-full md:w-96 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        >
                            <option value="">Alle bransjer</option>
                            {allNaceDivisions.map((div) => (
                                <option key={div.code} value={div.code}>
                                    {div.code} - {div.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <IndustryMap
                        selectedNace={selectedNaceForMap}
                        metric="company_count"
                        onSearchClick={handleMapSearchClick}
                        onCompanyClick={setSelectedCompanyOrgnr}
                    />
                </div>
            )}
            {activeTab === 'search' && <ExplorerLayout onSelectCompany={setSelectedCompanyOrgnr} />}

            {/* Company Modal Overlay - rendered when clicking company */}
            {selectedCompanyOrgnr && (
                <CompanyModalOverlay
                    orgnr={selectedCompanyOrgnr}
                    onClose={() => setSelectedCompanyOrgnr(null)}
                />
            )}
        </>
    )
}
