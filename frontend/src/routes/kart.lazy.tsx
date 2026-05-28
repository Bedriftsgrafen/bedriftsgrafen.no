/* eslint-disable react-refresh/only-export-components */
import { createLazyFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { useMemo, useState, useCallback, useEffect } from 'react'
import { Map as MapIcon } from 'lucide-react'
import { SEOHead } from '../components/layout'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { CompanyModalOverlay } from '../components/company/CompanyModalOverlay'
import { MapGuide } from '../components/maps/MapGuide'
import { MapFilterValues } from '../types/map'
import { useFilterStore } from '../store/filterStore'
import { cleanOrgnr } from '../utils/formatters'
import { IndustryMap } from '../components/maps/IndustryMap'
import type { KartSearch } from './kart'
import {
    buildMapFilterStoreUpdates,
    buildMapFiltersFromRouteSearch,
    buildMapRouteFilterUpdates,
    buildMapRouteSearchUpdates,
    type MapRouteSearchFilters,
} from '../utils/mapRouteSearchSync'

export const Route = createLazyFileRoute('/kart')({
    component: KartPage,
})

export function KartPage() {
    useDocumentTitle('Virksomhetskart | Bedriftsgrafen.no')
    const navigate = useNavigate({ from: '/kart' })
    const search = useSearch({ from: '/kart' })

    // eslint-disable-next-line @eslint-react/use-state -- intentional: wrapper adds cleanOrgnr transform
    const [selectedCompanyOrgnr, setRawSelectedCompanyOrgnr] = useState<string | null>(null)
    const setSelectedCompanyOrgnr = useCallback((orgnr: string | null) => {
        setRawSelectedCompanyOrgnr(cleanOrgnr(orgnr))
    }, [])

    const routeSearch = useMemo((): MapRouteSearchFilters => ({
        q: search.q,
        nace: search.nace,
        county: search.county,
        county_code: search.county_code,
        municipality: search.municipality,
        municipality_code: search.municipality_code,
        org_form: search.org_form,
        revenue_min: search.revenue_min,
        revenue_max: search.revenue_max,
        employee_min: search.employee_min,
        employee_max: search.employee_max,
        profit_min: search.profit_min,
        profit_max: search.profit_max,
        is_bankrupt: search.is_bankrupt,
        has_accounting: search.has_accounting,
        in_liquidation: search.in_liquidation,
        in_forced_liquidation: search.in_forced_liquidation,
        show_per_capita: search.show_per_capita,
    }), [search])

    useEffect(() => {
        const current = useFilterStore.getState()
        const updates = buildMapRouteFilterUpdates(routeSearch, current, { clearMissing: true, moneyUnit: 'mnok' })

        if (Object.keys(updates).length > 0) {
            current.setAllFilters(updates)
        }
    }, [routeSearch])

    // Map search params to MapFilterValues
    const filters = useMemo((): MapFilterValues => (
        buildMapFiltersFromRouteSearch(routeSearch, { moneyUnit: 'mnok' })
    ), [routeSearch])

    // Handlers to update URL search params and filterStore
    const handleFilterChange = useCallback((updates: Partial<MapFilterValues>) => {
        const storeUpdates = buildMapFilterStoreUpdates(updates)

        if (Object.keys(storeUpdates).length > 0) {
            useFilterStore.getState().setAllFilters(storeUpdates)
        }

        navigate({
            search: (prev: KartSearch): KartSearch => {
                return { ...prev, ...buildMapRouteSearchUpdates(updates, { moneyUnit: 'mnok' }) }
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
                title="Virksomhetskart | Bedriftsgrafen.no"
                description="Interaktivt kart over norske virksomheter. Se geografisk fordeling av virksomheter, ansatte og omsetning."
            />

            {/* Page header */}
            <div className="mb-6">
                <h1 className="text-2xl md:text-3xl font-bold text-black mb-2 flex items-center gap-3">
                    <MapIcon className="h-7 w-7 md:h-8 md:w-8 text-blue-500" />
                    Virksomhetskart
                </h1>
                <p className="text-gray-700 text-lg">
                    Interaktivt kart over norske virksomheter fordelt på fylker og kommuner.
                </p>
            </div>

            <MapGuide />



            <div className="relative h-225 overflow-hidden rounded-2xl border border-gray-100 shadow-sm md:h-200">
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
