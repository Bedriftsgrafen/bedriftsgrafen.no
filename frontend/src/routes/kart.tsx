import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState, useCallback, useEffect } from 'react'
import { Map as MapIcon } from 'lucide-react'
import { z } from 'zod'
import { SEOHead } from '../components/layout'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { IndustryMap } from '../components/maps/IndustryMap'
import { CompanyModalOverlay } from '../components/company/CompanyModalOverlay'
import { MapGuide } from '../components/maps/MapGuide'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { MapFilterValues } from '../types/map'
import { COUNTIES } from '../constants/explorer'
import { MUNICIPALITIES } from '../constants/municipalityCodes'
import { mnokToNok } from '../utils/financials'
import { useFilterStore, FilterValues } from '../store/filterStore'
import { cleanOrgnr } from '../utils/formatters'
import { defaultMapFilters } from '../types/map'

// Search params schema for all map filters
const searchSchema = z.object({
    nace: z.string().optional(),
    county: z.string().optional(),
    county_code: z.string().optional(),
    municipality: z.string().optional(),
    municipality_code: z.string().optional(),
    org_form: z.union([z.string(), z.array(z.string())]).optional(),
    q: z.string().optional(),
    revenue_min: z.coerce.number().optional(),
    revenue_max: z.coerce.number().optional(),
    profit_min: z.coerce.number().optional(),
    profit_max: z.coerce.number().optional(),
    employee_min: z.coerce.number().optional(),
    employee_max: z.coerce.number().optional(),
    is_bankrupt: z.coerce.boolean().optional(),
    has_accounting: z.coerce.boolean().optional(),
    in_liquidation: z.coerce.boolean().optional(),
})

type SearchSchema = z.infer<typeof searchSchema>

export const Route = createFileRoute('/kart')({
    validateSearch: searchSchema,
    component: KartPage,
})

function KartPage() {
    useDocumentTitle('Bedriftskart | Bedriftsgrafen.no')
    const navigate = useNavigate({ from: '/kart' })
    const search = useSearch({ from: '/kart' })

    const [selectedCompanyOrgnr, _setSelectedCompanyOrgnr] = useState<string | null>(null)
    const setSelectedCompanyOrgnr = useCallback((orgnr: string | null) => {
        _setSelectedCompanyOrgnr(cleanOrgnr(orgnr))
    }, [])

    // Read filter state from store
    const { naeringskode, searchQuery, setSearchQuery } = useFilterStore()

    // Sync search query between store and URL
    useEffect(() => {
        if (search.q !== undefined && search.q !== searchQuery) {
            setSearchQuery(search.q || '')
        }
    }, [search.q, searchQuery, setSearchQuery])

    // Map search params to MapFilterValues
    const filters = useMemo((): MapFilterValues => ({
        ...defaultMapFilters,
        query: search.q || searchQuery || null,
        naceCode: search.nace || naeringskode || null,
        countyCode: search.county_code || null,
        municipalityCode: search.municipality_code || null,
        organizationForms: !search.org_form ? [] : (Array.isArray(search.org_form) ? search.org_form : [search.org_form as string]),
        revenueMin: search.revenue_min != null ? (mnokToNok(search.revenue_min) ?? null) : null,
        revenueMax: search.revenue_max != null ? (mnokToNok(search.revenue_max) ?? null) : null,
        profitMin: search.profit_min != null ? (mnokToNok(search.profit_min) ?? null) : null,
        profitMax: search.profit_max != null ? (mnokToNok(search.profit_max) ?? null) : null,
        employeeMin: search.employee_min || null,
        employeeMax: search.employee_max || null,
        isBankrupt: search.is_bankrupt ?? null,
        hasAccounting: search.has_accounting ?? null,
        inLiquidation: search.in_liquidation ?? null,
    }), [search, naeringskode, searchQuery])

    // Handlers to update URL search params and filterStore
    const handleFilterChange = useCallback((updates: Partial<MapFilterValues>) => {
        // Sync with filterStore for consistent views across tabs
        const storeUpdates: Partial<FilterValues> = {}
        if ('query' in updates) storeUpdates.searchQuery = updates.query || ''
        if ('naceCode' in updates) storeUpdates.naeringskode = updates.naceCode || ''
        if ('countyCode' in updates) storeUpdates.countyCode = updates.countyCode || ''
        if ('municipalityCode' in updates) storeUpdates.municipalityCode = updates.municipalityCode || ''
        if ('revenueMin' in updates) storeUpdates.revenueMin = updates.revenueMin
        if ('revenueMax' in updates) storeUpdates.revenueMax = updates.revenueMax
        if ('employeeMin' in updates) storeUpdates.employeeMin = updates.employeeMin
        if ('employeeMax' in updates) storeUpdates.employeeMax = updates.employeeMax
        if ('profitMin' in updates) storeUpdates.profitMin = updates.profitMin
        if ('profitMax' in updates) storeUpdates.profitMax = updates.profitMax
        if ('organizationForms' in updates) storeUpdates.organizationForms = updates.organizationForms || []
        if ('isBankrupt' in updates) storeUpdates.isBankrupt = updates.isBankrupt

        if (Object.keys(storeUpdates).length > 0) {
            useFilterStore.setState(storeUpdates)
        }

        navigate({
            search: (prev: SearchSchema): SearchSchema => {
                const newSearch = { ...prev }

                if ('query' in updates) newSearch.q = updates.query || undefined
                if ('naceCode' in updates) newSearch.nace = updates.naceCode || undefined
                if ('countyCode' in updates) {
                    newSearch.county_code = updates.countyCode || undefined
                    newSearch.municipality_code = undefined
                    newSearch.county = updates.countyCode ? COUNTIES.find(c => c.code === updates.countyCode)?.name : undefined
                    newSearch.municipality = undefined
                }
                if ('municipalityCode' in updates) {
                    newSearch.municipality_code = updates.municipalityCode || undefined
                    newSearch.municipality = updates.municipalityCode ? MUNICIPALITIES.find(m => m.code === updates.municipalityCode)?.name : undefined
                }
                if ('organizationForms' in updates) newSearch.org_form = (updates.organizationForms && updates.organizationForms.length > 0) ? updates.organizationForms : undefined

                // Convert back to MNOK for URL
                if ('revenueMin' in updates) newSearch.revenue_min = updates.revenueMin != null ? updates.revenueMin / 1_000_000 : undefined
                if ('revenueMax' in updates) newSearch.revenue_max = updates.revenueMax != null ? updates.revenueMax / 1_000_000 : undefined
                if ('profitMin' in updates) newSearch.profit_min = updates.profitMin != null ? updates.profitMin / 1_000_000 : undefined
                if ('profitMax' in updates) newSearch.profit_max = updates.profitMax != null ? updates.profitMax / 1_000_000 : undefined
                if ('employeeMin' in updates) newSearch.employee_min = updates.employeeMin ?? undefined
                if ('employeeMax' in updates) newSearch.employee_max = updates.employeeMax ?? undefined
                if ('isBankrupt' in updates) newSearch.is_bankrupt = updates.isBankrupt ?? undefined
                if ('hasAccounting' in updates) newSearch.has_accounting = updates.hasAccounting ?? undefined
                if ('inLiquidation' in updates) newSearch.in_liquidation = updates.inLiquidation ?? undefined

                return newSearch
            }
        })
    }, [navigate])

    const handleClearFilters = useCallback(() => {
        useFilterStore.getState().clearFilters()
        navigate({ search: {} })
    }, [navigate])

    return (
        <>
            <SEOHead
                title="Bedriftskart | Bedriftsgrafen.no"
                description="Interaktivt kart over norske bedrifter. Se geografisk fordeling av selskaper, ansatte og omsetning."
            />

            {/* Page header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-black mb-2 flex items-center gap-3">
                    <MapIcon className="h-8 w-8 text-blue-500" />
                    Bedriftskart
                </h1>
                <p className="text-gray-700 text-lg">
                    Interaktivt kart over norske bedrifter fordelt på fylker og kommuner.
                </p>
            </div>

            <MapGuide />



            <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm h-[900px] md:h-[800px] relative">
                <IndustryMap
                    filters={filters}
                    onFilterChange={handleFilterChange}
                    onClearFilters={handleClearFilters}
                    selectedNace={filters.naceCode}
                    metric="company_count"
                    onCompanyClick={setSelectedCompanyOrgnr}
                    onRegionClick={(_name, code, level) => {
                        if (level === 'county') {
                            handleFilterChange({ countyCode: code, municipalityCode: null })
                        } else {
                            handleFilterChange({ municipalityCode: code })
                        }
                    }}
                    countyFromExplorer={search.county}
                    countyCodeFromExplorer={filters.countyCode || undefined}
                    municipalityFromExplorer={search.municipality}
                    municipalityCodeFromExplorer={filters.municipalityCode || undefined}
                    organizationForms={filters.organizationForms}
                    revenueMin={filters.revenueMin}
                    revenueMax={filters.revenueMax}
                    profitMin={filters.profitMin}
                    profitMax={filters.profitMax}
                    equityMin={filters.equityMin}
                    equityMax={filters.equityMax}
                    operatingProfitMin={filters.operatingProfitMin}
                    operatingProfitMax={filters.operatingProfitMax}
                    liquidityRatioMin={filters.liquidityRatioMin}
                    liquidityRatioMax={filters.liquidityRatioMax}
                    equityRatioMin={filters.equityRatioMin}
                    equityRatioMax={filters.equityRatioMax}
                    employeeMin={filters.employeeMin}
                    employeeMax={filters.employeeMax}
                    foundedFrom={filters.foundedFrom}
                    foundedTo={filters.foundedTo}
                    bankruptFrom={filters.bankruptFrom}
                    bankruptTo={filters.bankruptTo}
                    isBankrupt={filters.isBankrupt}
                    inLiquidation={filters.inLiquidation}
                    inForcedLiquidation={filters.inForcedLiquidation}
                    hasAccounting={filters.hasAccounting}
                />
            </div>

            {/* Company Modal */}
            {selectedCompanyOrgnr && (
                <CompanyModalOverlay
                    orgnr={selectedCompanyOrgnr}
                    onClose={() => setSelectedCompanyOrgnr(null)}
                    onSelectCompany={setSelectedCompanyOrgnr}
                />
            )}
        </>
    )
}
