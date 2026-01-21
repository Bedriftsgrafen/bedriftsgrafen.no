import { useState, useMemo, useCallback } from 'react'
import { TrendingUp, Users, Wallet, Activity, MapPin, Globe, ChevronDown } from 'lucide-react'
import { useBenchmarkQuery } from '../../hooks/queries/useBenchmarkQuery'
import { formatCurrency, formatNumber, formatPercentValue } from '../../utils/formatters'
import type { CompanyWithAccounting } from '../../types'
import { BenchmarkCard } from './BenchmarkCard'
import { getNaceLevel } from '../../utils/nace'

interface IndustryBenchmarkProps {
    company: CompanyWithAccounting
}

// Memoized icons to prevent re-renders in child components
const BENCHMARK_ICONS = {
    revenue: <Wallet className="h-5 w-5 text-blue-600" />,
    profit: <TrendingUp className="h-5 w-5 text-green-600" />,
    margin: <Activity className="h-5 w-5 text-purple-600" />,
    employees: <Users className="h-5 w-5 text-orange-600" />,
} as const

type ComparisonScope = 'national' | 'municipal'

export function IndustryBenchmark({ company }: IndustryBenchmarkProps) {
    const [scope, setScope] = useState<ComparisonScope>('national')
    const [selectedNaceCode, setSelectedNaceCode] = useState(company.naeringskode)


    // Extract municipality code from company address
    const municipalityCode = useMemo(() => {
        return company.forretningsadresse?.kommunenummer ?? null
    }, [company.forretningsadresse])

    const municipalityName = useMemo(() => {
        return company.forretningsadresse?.kommune ?? null
    }, [company.forretningsadresse])

    // Only fetch municipal if user selected it AND municipality is available
    const effectiveMunicipalityCode = scope === 'municipal' && municipalityCode ? municipalityCode : null

    const { data: benchmark, isLoading, isError, error } = useBenchmarkQuery(
        selectedNaceCode || company.naeringskode,
        company.orgnr,
        effectiveMunicipalityCode
    )

    // Check if we requested municipal but got national fallback
    const requestedMunicipal = scope === 'municipal' && municipalityCode
    const gotNationalFallback = requestedMunicipal && benchmark && !benchmark.municipality_code

    const handleSetNational = useCallback(() => setScope('national'), [])
    const handleSetMunicipal = useCallback(() => setScope('municipal'), [])

    if (isLoading) {
        return (
            <div className="animate-pulse space-y-4 mb-8" role="status" aria-live="polite" aria-label="Laster bransjesammenligning">
                <div className="flex items-center gap-2 mb-6">
                    <div className="h-5 w-5 bg-gray-200 rounded-full" />
                    <div className="h-6 w-48 bg-gray-200 rounded" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 h-64">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="h-8 w-8 bg-gray-100 rounded-lg" />
                                <div className="space-y-1 flex-1">
                                    <div className="h-3 w-20 bg-gray-100 rounded" />
                                    <div className="h-5 w-24 bg-gray-100 rounded" />
                                </div>
                            </div>
                            <div className="h-32 bg-gray-50 rounded w-full mb-2" />
                            <div className="h-3 w-1/2 bg-gray-100 rounded mx-auto" />
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (isError) {
        return (
            <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg" role="alert">
                <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-red-600" />
                    <h3 className="text-sm font-medium text-red-800">
                        Kunne ikke laste bransjesammenligning
                    </h3>
                </div>
                <p className="text-sm text-red-600 mt-1">
                    {error instanceof Error
                        ? error.message
                        : 'Det er ikke nok data tilgjengelig for å sammenligne med bransjen.'}
                </p>
            </div>
        )
    }

    if (!benchmark) return null

    const naceLevel = getNaceLevel(benchmark.nace_code)
    const hasMunicipalOption = !!municipalityCode
    const hasMultipleNace = (company.naeringskoder?.length ?? 0) > 1

    // Get the actual NACE description for the SELECTED code
    const selectedNaceData = company.naeringskoder?.find(nk => nk.kode === selectedNaceCode)
    const naceDescription = selectedNaceData?.beskrivelse || benchmark.nace_name || 'bransjen'

    return (
        <div className="mb-8" role="region" aria-label="Bransjesammenligning">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    <div>
                        <h3 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                            Bransjesammenligning
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${naceLevel === 'Underbransje'
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-gray-100 text-gray-700'
                                }`}>
                                {naceLevel}
                            </span>
                        </h3>
                        <p className="text-sm text-gray-500">
                            Sammenlignet med {benchmark.company_count} bedrifter
                            {benchmark.municipality_code && municipalityName && (
                                <> i <span className="font-medium">{municipalityName}</span></>
                            )}
                            {' '}i {naceDescription}
                            <span className="text-gray-400 ml-1">({benchmark.nace_code})</span>
                        </p>
                        {gotNationalFallback && (
                            <p className="text-xs text-amber-600 mt-1">
                                ⚠️ For få bedrifter i kommunen – viser nasjonal sammenligning
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                    {/* NACE Selector for companies with multiple industries */}
                    {hasMultipleNace && (
                        <div className="relative inline-block w-full sm:w-auto">
                            <select
                                value={selectedNaceCode || ''}
                                onChange={(e) => setSelectedNaceCode(e.target.value)}
                                className="appearance-none w-full bg-white border border-gray-200 text-gray-700 py-2 px-4 pr-10 rounded-lg leading-tight focus:outline-none focus:bg-white focus:border-blue-500 text-sm font-medium shadow-sm cursor-pointer hover:border-blue-300 transition-all"
                                aria-label="Velg bransje for sammenligning"
                            >
                                {company.naeringskoder?.map((nk) => (
                                    <option key={nk.kode} value={nk.kode}>
                                        {nk.kode} - {nk.beskrivelse}
                                    </option>
                                ))}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                                <ChevronDown className="h-4 w-4" />
                            </div>
                        </div>
                    )}


                    {/* Scope Toggle */}
                    {hasMunicipalOption && (
                        <div className="flex bg-gray-100 rounded-lg p-1 text-sm">
                            <button
                                onClick={handleSetNational}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${scope === 'national'
                                    ? 'bg-white text-blue-700 shadow-sm font-medium'
                                    : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                aria-pressed={scope === 'national'}
                            >
                                <Globe className="h-3.5 w-3.5" />
                                Nasjonal
                            </button>
                            <button
                                onClick={handleSetMunicipal}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors ${scope === 'municipal'
                                    ? 'bg-white text-blue-700 shadow-sm font-medium'
                                    : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                aria-pressed={scope === 'municipal'}
                            >
                                <MapPin className="h-3.5 w-3.5" />
                                {municipalityName || 'Kommune'}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <BenchmarkCard
                    title="Omsetning"
                    metric={benchmark.revenue}
                    icon={BENCHMARK_ICONS.revenue}
                    formatter={formatCurrency}
                    color="bg-blue-600"
                    companyName={company.navn}
                />
                <BenchmarkCard
                    title="Resultat"
                    metric={benchmark.profit}
                    icon={BENCHMARK_ICONS.profit}
                    formatter={formatCurrency}
                    color="bg-green-600"
                    companyName={company.navn}
                />
                <BenchmarkCard
                    title="Driftsmargin"
                    metric={benchmark.operating_margin}
                    icon={BENCHMARK_ICONS.margin}
                    formatter={formatPercentValue}
                    color="bg-purple-600"
                    companyName={company.navn}
                />
                <BenchmarkCard
                    title="Ansatte"
                    metric={benchmark.employees}
                    icon={BENCHMARK_ICONS.employees}
                    formatter={formatNumber}
                    color="bg-orange-600"
                    companyName={company.navn}
                />
            </div>
        </div>
    )
}
