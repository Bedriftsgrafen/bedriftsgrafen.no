import { createLazyFileRoute } from '@tanstack/react-router'
import { ExplorerLayout } from '../components/explorer'
import { SEOHead } from '../components/layout'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { IndustryDashboard } from '../components/dashboard/IndustryDashboard'
import { IndustryMap } from '../components/maps/IndustryMap'
import { CompanyModalOverlay } from '../components/company/CompanyModalOverlay'
import { useMemo, useCallback } from 'react'
import { BarChart3, Search, Map } from 'lucide-react'
import { TabButton } from '../components/common'
import { NACE_CODES, NACE_DIVISIONS } from '../constants/explorer'
import { useFilterStore } from '../store/filterStore'
import { formatMunicipalityName } from '../constants/municipalities'

// Tab type for type safety
type BransjerTab = 'stats' | 'search' | 'map'

/**
 * Internal hook to compute map location filters from sessionStorage or filterStore
 */
function useBransjerMapFilters(tab: BransjerTab, municipalityCode: string | null) {
    return useMemo(() => {
        if (tab !== 'map') {
            return {
                county: '',
                countyCode: '',
                municipality: '',
                municipalityCode: '',
                organizationForms: [],
                revenueMin: null,
                revenueMax: null,
                employeeMin: null,
                employeeMax: null
            }
        }

        // Try sessionStorage first (set by "Se i kart" button)
        const storedFilter = typeof window !== 'undefined' ? sessionStorage.getItem('mapFilter') : null
        if (storedFilter) {
            try {
                const parsed = JSON.parse(storedFilter)
                // Clear after reading to avoid stale data on next render
                sessionStorage.removeItem('mapFilter')
                return {
                    county: parsed.county || '',
                    countyCode: parsed.county_code || '',
                    municipality: parsed.municipality || '',
                    municipalityCode: parsed.municipality_code || '',
                    organizationForms: parsed.org_form || [],
                    revenueMin: parsed.revenue_min ?? null,
                    revenueMax: parsed.revenue_max ?? null,
                    employeeMin: parsed.employee_min ?? null,
                    employeeMax: parsed.employee_max ?? null
                }
            } catch {
                // Fallback to filterStore values
            }
        }

        // No sessionStorage, use current filterStore values
        const state = useFilterStore.getState()
        return {
            county: state.county || '',
            countyCode: state.countyCode || '',
            municipality: state.municipality || '',
            municipalityCode: municipalityCode || '',
            organizationForms: state.organizationForms,
            revenueMin: state.revenueMin,
            revenueMax: state.revenueMax,
            employeeMin: state.employeeMin,
            employeeMax: state.employeeMax
        }
    }, [tab, municipalityCode])
}

/**
 * Internal hook to compute NACE options list for the selector
 */
function useNaceOptions(selectedNace: string | null) {
    const { naeringskode } = useFilterStore()

    return useMemo(() => {
        const options: { code: string; name: string; section?: string; isSection?: boolean }[] = []

        // Add top-level sections (A-U)
        for (const section of NACE_CODES) {
            options.push({
                code: section.code,
                name: section.name,
                isSection: true,
            })

            // Add divisions under this section
            const sectionDivisions = NACE_DIVISIONS[section.code] || []
            for (const div of sectionDivisions) {
                options.push({
                    code: div.code,
                    name: div.name,
                    section: section.code,
                })
            }
        }

        // If current NACE is not in the list (e.g. subclass 62.100), add it as a special option
        const currentNace = selectedNace || naeringskode
        if (currentNace && !options.some(opt => opt.code === currentNace)) {
            options.push({
                code: currentNace,
                name: 'Valgt bransje',
                isSection: false
            })
        }

        return options
    }, [selectedNace, naeringskode])
}

export const Route = createLazyFileRoute('/bransjer')({
    component: BransjerPage,
})

function BransjerPage() {
    useDocumentTitle('Utforsk bransjer | Bedriftsgrafen.no')
    const navigate = Route.useNavigate()
    const { nace, tab, orgnr } = Route.useSearch()

    // Read filter state from store
    const { municipalityCode, naeringskode } = useFilterStore()

    // Tab state persisted in URL - defaults to 'stats' unless mapFilter is present at mount
    const activeTab = useMemo(() => {
        if (tab) return tab as BransjerTab
        if (typeof window !== 'undefined' && sessionStorage.getItem('mapFilter')) {
            return 'search'
        }
        return 'stats'
    }, [tab])

    // Compute derived data using internal hooks
    const mapFilters = useBransjerMapFilters(activeTab, municipalityCode)

    const [selectedNaceForMap, setSelectedNaceForMap] = useMemo(() => {
        return [nace || null, (value: string | null) => {
            navigate({
                to: '/bransjer',
                search: (prev) => ({ ...prev, nace: value ?? undefined }),
                replace: true,
            })
        }]
    }, [nace, navigate])

    const allNaceOptions = useNaceOptions(selectedNaceForMap)

    // Change tab by updating URL search params
    const setActiveTab = useCallback((newTab: BransjerTab) => {
        navigate({
            to: '/bransjer',
            search: (prev) => ({ ...prev, tab: newTab }),
            replace: true,
        })
    }, [navigate])

    const selectedCompanyOrgnr = orgnr ?? null

    const setSelectedCompanyOrgnr = useCallback((orgnr: string | null) => {
        navigate({
            to: '/bransjer',
            search: (prev) => ({ ...prev, orgnr: orgnr ?? undefined }),
            replace: true,
        })
    }, [navigate])

    // Handle search click from map - switch to search tab and store filter
    const handleMapSearchClick = useCallback((regionName: string, regionCode: string, naceCode: string | null) => {
        const cleanName = regionName.split(' - ')[0].trim()
        const normalizedName = formatMunicipalityName(cleanName)
        const isCounty = regionCode.length === 2

        sessionStorage.setItem('mapFilter', JSON.stringify({
            county: isCounty ? normalizedName : '',
            county_code: isCounty ? regionCode : '',
            municipality: isCounty ? '' : normalizedName,
            municipality_code: isCounty ? '' : regionCode,
            nace: naceCode,
        }))
        setActiveTab('search')
    }, [setActiveTab])

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
                            {allNaceOptions.map((opt) => (
                                <option
                                    key={opt.code}
                                    value={opt.code}
                                    style={opt.isSection ? { fontWeight: 'bold' } : undefined}
                                >
                                    {opt.isSection ? '' : '\u00A0\u00A0'}{opt.code} - {opt.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <IndustryMap
                        selectedNace={selectedNaceForMap || naeringskode || undefined}
                        metric="company_count"
                        onSearchClick={handleMapSearchClick}
                        onCompanyClick={setSelectedCompanyOrgnr}
                        countyFromExplorer={mapFilters.county}
                        countyCodeFromExplorer={mapFilters.countyCode}
                        municipalityFromExplorer={mapFilters.municipality}
                        municipalityCodeFromExplorer={mapFilters.municipalityCode}
                        organizationForms={mapFilters.organizationForms}
                        revenueMin={mapFilters.revenueMin}
                        revenueMax={mapFilters.revenueMax}
                        employeeMin={mapFilters.employeeMin}
                        employeeMax={mapFilters.employeeMax}
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
