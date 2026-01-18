import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo, useCallback } from 'react'
import { Map as MapIcon } from 'lucide-react'
import { z } from 'zod'
import { SEOHead } from '../components/layout'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { IndustryMap } from '../components/maps/IndustryMap'
import { CompanyModalOverlay } from '../components/company/CompanyModalOverlay'
import { MapGuide } from '../components/maps/MapGuide'
import { MapFilterBar } from '../components/maps/MapFilterBar'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { mnokToNok } from '../utils/financials'

// Search params schema for optional NACE filter
const searchSchema = z.object({
    nace: z.string().optional(),
    county: z.string().optional(),
    county_code: z.string().optional(),
    municipality: z.string().optional(),
    municipality_code: z.string().optional(),
    org_form: z.union([z.string(), z.array(z.string())]).optional(),
    revenue_min: z.coerce.number().optional(),
    revenue_max: z.coerce.number().optional(),
    employee_min: z.coerce.number().optional(),
    employee_max: z.coerce.number().optional(),
})

export const Route = createFileRoute('/kart')({
    validateSearch: searchSchema,
    component: KartPage,
})

function KartPage() {
    useDocumentTitle('Bedriftskart | Bedriftsgrafen.no')
    const navigate = useNavigate({ from: '/kart' })
    const search = useSearch({ from: '/kart' })

    // Derived state from URL search params
    const selectedNace = search.nace || null
    const selectedCountyCode = search.county_code || null
    const selectedCountyName = search.county || null
    const selectedMunicipalityCode = search.municipality_code || null
    const selectedMunicipalityName = search.municipality || null
    const selectedOrgForms = useMemo(() => {
        if (!search.org_form) return []
        return Array.isArray(search.org_form) ? search.org_form : [search.org_form]
    }, [search.org_form])

    // Normalize financials: URL has MNOK, but IndustryMap/CompanyMarkers expect NOK
    const revenueMin = useMemo(() => mnokToNok(search.revenue_min), [search.revenue_min])
    const revenueMax = useMemo(() => mnokToNok(search.revenue_max), [search.revenue_max])
    const employeeMin = search.employee_min || null
    const employeeMax = search.employee_max || null

    const [selectedCompanyOrgnr, setSelectedCompanyOrgnr] = useState<string | null>(null)

    // Handlers to update URL search params
    const handleNaceChange = useCallback((nace: string | null) => {
        navigate({ search: (prev) => ({ ...prev, nace: nace || undefined }) })
    }, [navigate])

    const handleCountyChange = useCallback((name: string, code: string) => {
        navigate({
            search: (prev) => ({
                ...prev,
                county: name || undefined,
                county_code: code || undefined,
                municipality: undefined,
                municipality_code: undefined
            })
        })
    }, [navigate])

    const handleMunicipalityChange = useCallback((name: string, code: string) => {
        navigate({
            search: (prev) => ({
                ...prev,
                municipality: name || undefined,
                municipality_code: code || undefined
            })
        })
    }, [navigate])

    const handleOrgFormsChange = useCallback((forms: string[]) => {
        navigate({ search: (prev) => ({ ...prev, org_form: forms.length > 0 ? forms : undefined }) })
    }, [navigate])

    const handleRevenueChange = useCallback((val: number | null) => {
        navigate({ search: (prev) => ({ ...prev, revenue_min: val ?? undefined }) })
    }, [navigate])

    const handleEmployeeChange = useCallback((val: number | null) => {
        navigate({ search: (prev) => ({ ...prev, employee_min: val ?? undefined }) })
    }, [navigate])

    const handleClearFilters = useCallback(() => {
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

            {/* Enhanced Filter Bar */}
            <MapFilterBar
                selectedNace={selectedNace}
                onNaceChange={handleNaceChange}
                selectedCountyCode={selectedCountyCode}
                onCountyChange={handleCountyChange}
                selectedMunicipalityCode={selectedMunicipalityCode}
                onMunicipalityChange={handleMunicipalityChange}
                selectedOrgForms={selectedOrgForms}
                onOrgFormsChange={handleOrgFormsChange}
                revenueMin={search.revenue_min ?? null}
                onRevenueChange={handleRevenueChange}
                employeeMin={search.employee_min ?? null}
                onEmployeeChange={handleEmployeeChange}
                onClear={handleClearFilters}
            />

            <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm h-[600px] relative">
                <IndustryMap
                    selectedNace={selectedNace}
                    metric="company_count"
                    onCompanyClick={setSelectedCompanyOrgnr}
                    countyFromExplorer={selectedCountyName || undefined}
                    countyCodeFromExplorer={selectedCountyCode || undefined}
                    municipalityFromExplorer={selectedMunicipalityName || undefined}
                    municipalityCodeFromExplorer={selectedMunicipalityCode || undefined}
                    organizationForms={selectedOrgForms}
                    revenueMin={revenueMin}
                    revenueMax={revenueMax}
                    employeeMin={employeeMin}
                    employeeMax={employeeMax}
                />
            </div>

            {/* Company Modal */}
            {selectedCompanyOrgnr && (
                <CompanyModalOverlay
                    orgnr={selectedCompanyOrgnr}
                    onClose={() => setSelectedCompanyOrgnr(null)}
                />
            )}
        </>
    )
}
