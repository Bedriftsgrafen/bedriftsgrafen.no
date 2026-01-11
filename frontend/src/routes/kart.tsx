import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { Map as MapIcon } from 'lucide-react'
import { z } from 'zod'
import { SEOHead } from '../components/layout'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { IndustryMap } from '../components/maps/IndustryMap'
import { CompanyModalOverlay } from '../components/company/CompanyModalOverlay'
import { NACE_CODES, NACE_DIVISIONS } from '../constants/explorer'

// Search params schema for optional NACE filter
const searchSchema = z.object({
    nace: z.string().optional(),
})

export const Route = createFileRoute('/kart')({
    validateSearch: searchSchema,
    component: KartPage,
})

function KartPage() {
    useDocumentTitle('Bedriftskart | Bedriftsgrafen.no')
    const [selectedCompanyOrgnr, setSelectedCompanyOrgnr] = useState<string | null>(null)
    const [selectedNace, setSelectedNace] = useState<string | null>(null)

    // Flatten all NACE divisions for filter dropdown
    const allNaceDivisions = useMemo(() => {
        const divisions: { code: string; name: string }[] = []
        for (const section of NACE_CODES) {
            const sectionDivisions = NACE_DIVISIONS[section.code] || []
            for (const div of sectionDivisions) {
                divisions.push({ code: div.code, name: div.name })
            }
        }
        return divisions.sort((a, b) => parseInt(a.code) - parseInt(b.code))
    }, [])

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

            {/* Filter bar */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                <label htmlFor="nace-filter" className="block text-sm font-medium text-gray-700 mb-2">
                    Filtrer etter bransje
                </label>
                <select
                    id="nace-filter"
                    value={selectedNace || ''}
                    onChange={(e) => setSelectedNace(e.target.value || null)}
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

            {/* Full-width map */}
            <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                <IndustryMap
                    selectedNace={selectedNace}
                    metric="company_count"
                    onCompanyClick={setSelectedCompanyOrgnr}
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
