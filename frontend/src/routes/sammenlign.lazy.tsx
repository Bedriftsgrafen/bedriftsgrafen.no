import { createLazyFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState, useRef, startTransition, useMemo, useCallback } from 'react'
import { Building2, Users, TrendingUp, TrendingDown, Wallet, X, ArrowLeft, Share2 } from 'lucide-react'
import { SEOHead } from '../components/layout'
import { apiClient } from '../utils/apiClient'
import { formatLargeNumber } from '../utils/formatters'
import { formatNace } from '../utils/nace'
import type { CompanyWithAccounting } from '../types'
import { useComparisonStore } from '../store/comparisonStore'

export const Route = createLazyFileRoute('/sammenlign')({
    component: ComparisonPage,
})

/** Fetched company data for comparison */
interface ComparisonData {
    orgnr: string
    company: CompanyWithAccounting | null
    loading: boolean
    error: string | null
}

function ComparisonCard({ item, onRemove }: { item: ComparisonData; onRemove?: (orgnr: string) => void }) {
    const accounting = useMemo(() => {
        if (!item.company?.regnskap || item.company.regnskap.length === 0) return null
        return [...item.company.regnskap].sort((a, b) => b.aar - a.aar)[0]
    }, [item.company])

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4 relative">
            {onRemove && (
                <button
                    onClick={() => onRemove(item.orgnr)}
                    className="absolute top-3 right-3 p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Fjern fra sammenligning"
                    aria-label="Fjern fra sammenligning"
                >
                    <X className="h-4 w-4 text-gray-400" />
                </button>
            )}

            {item.loading ? (
                <div className="animate-pulse space-y-3">
                    <div className="h-6 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-24 bg-gray-200 rounded" />
                </div>
            ) : item.error ? (
                <div className="text-red-500 text-sm">{item.error}</div>
            ) : item.company ? (
                <>
                    {/* Company header */}
                    <div className="pr-8">
                        <Link
                            to="/bedrift/$orgnr"
                            params={{ orgnr: item.orgnr }}
                            className="font-semibold text-gray-900 hover:text-blue-600 line-clamp-2 transition-colors"
                        >
                            {item.company.navn}
                        </Link>
                        <p className="text-sm text-gray-500">
                            {item.company.organisasjonsform} • {item.orgnr}
                        </p>
                    </div>

                    {/* Basic info */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            <span className="truncate" title={formatNace(item.company.naeringskode)}>
                                {formatNace(item.company.naeringskode) || 'Ukjent bransje'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Users className="h-4 w-4 text-gray-400" />
                            <span className="text-gray-600">
                                {item.company.antall_ansatte ?? '-'} ansatte
                            </span>
                        </div>
                    </div>

                    {/* Financial data */}
                    {accounting ? (
                        <div className="space-y-3 pt-3 border-t border-gray-100">
                            <p className="text-xs text-gray-400">
                                Regnskap {accounting.aar}
                            </p>

                            {/* Revenue */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <TrendingUp className="h-4 w-4 text-blue-500" />
                                    Omsetning
                                </div>
                                <span className="font-semibold text-gray-900">
                                    {formatLargeNumber(accounting.salgsinntekter)}
                                </span>
                            </div>

                            {/* Result */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    {(accounting.aarsresultat ?? 0) >= 0 ? (
                                        <TrendingUp className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <TrendingDown className="h-4 w-4 text-red-500" />
                                    )}
                                    Resultat
                                </div>
                                <span className={`font-semibold ${(accounting.aarsresultat ?? 0) >= 0
                                    ? 'text-green-600'
                                    : 'text-red-600'
                                    }`}>
                                    {formatLargeNumber(accounting.aarsresultat)}
                                </span>
                            </div>

                            {/* Equity */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Wallet className="h-4 w-4 text-purple-500" />
                                    Egenkapital
                                </div>
                                <span className="font-semibold text-gray-900">
                                    {formatLargeNumber(accounting.egenkapital)}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 pt-3 border-t border-gray-100">
                            Ingen regnskapsdata
                        </p>
                    )}
                </>
            ) : null}
        </div>
    )
}

function ComparisonPage() {
    const { orgnr: orgnrParam } = Route.useSearch()
    const navigate = Route.useNavigate()

    // Get companies from store (for when navigating from ComparisonBar)
    const storeCompanies = useComparisonStore((s) => s.companies)
    const clearStore = useComparisonStore((s) => s.clear)

    const [data, setData] = useState<ComparisonData[]>([])
    const fetchIdRef = useRef(0)

    // Determine which org numbers to use (URL params take priority, then store)
    const orgNumbers = useMemo(() => {
        if (orgnrParam) {
            return orgnrParam.split(',').filter(Boolean).slice(0, 5) // Max 5
        }
        return storeCompanies.map(c => c.orgnr)
    }, [orgnrParam, storeCompanies])

    // Fetch company data
    useEffect(() => {
        if (orgNumbers.length === 0) {
            startTransition(() => setData([]))
            return
        }

        const fetchId = ++fetchIdRef.current

        // Create loading state
        const loadingState: ComparisonData[] = orgNumbers.map((orgnr) => ({
            orgnr,
            company: null,
            loading: true,
            error: null,
        }))

        startTransition(() => setData(loadingState))

        // Fetch data
        Promise.all(
            orgNumbers.map(async (orgnr) => {
                try {
                    const response = await apiClient.get<CompanyWithAccounting>(
                        `/v1/companies/${orgnr}`
                    )
                    return {
                        orgnr,
                        company: response.data,
                        loading: false,
                        error: null,
                    }
                } catch {
                    return {
                        orgnr,
                        company: null,
                        loading: false,
                        error: 'Kunne ikke hente data',
                    }
                }
            })
        ).then((results) => {
            if (fetchId === fetchIdRef.current) {
                startTransition(() => setData(results))
            }
        })
    }, [orgNumbers])

    // Update URL when removing a company
    const handleRemove = useCallback((orgnrToRemove: string) => {
        const newOrgNumbers = orgNumbers.filter(o => o !== orgnrToRemove)
        if (newOrgNumbers.length === 0) {
            clearStore()
            navigate({ to: '/' })
        } else {
            navigate({
                to: '/sammenlign',
                search: { orgnr: newOrgNumbers.join(',') },
                replace: true
            })
        }
    }, [orgNumbers, navigate, clearStore])

    // Share URL
    const handleShare = useCallback(async () => {
        const url = `${window.location.origin}/sammenlign?orgnr=${orgNumbers.join(',')}`
        try {
            await navigator.clipboard.writeText(url)
            // Could add toast notification here
        } catch {
            // Fallback for older browsers
            window.prompt('Kopier lenken:', url)
        }
    }, [orgNumbers])

    // Sync URL params when coming from store
    useEffect(() => {
        if (!orgnrParam && storeCompanies.length > 0) {
            navigate({
                to: '/sammenlign',
                search: { orgnr: storeCompanies.map(c => c.orgnr).join(',') },
                replace: true
            })
        }
    }, [orgnrParam, storeCompanies, navigate])

    return (
        <>
            <SEOHead
                title="Sammenlign bedrifter - Bedriftsgrafen.no"
                description="Sammenlign nøkkeltall og økonomi mellom norske bedrifter side ved side."
            />

            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <Link
                            to="/"
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Tilbake"
                            aria-label="Tilbake til forsiden"
                        >
                            <ArrowLeft className="h-5 w-5 text-gray-600" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">
                                Sammenlign bedrifter
                            </h1>
                            <p className="text-sm text-gray-500">
                                {orgNumbers.length > 0
                                    ? `${orgNumbers.length} bedrift${orgNumbers.length > 1 ? 'er' : ''} valgt`
                                    : 'Ingen bedrifter valgt'}
                            </p>
                        </div>
                    </div>

                    {orgNumbers.length > 0 && (
                        <button
                            onClick={handleShare}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <Share2 className="h-4 w-4" />
                            Del
                        </button>
                    )}
                </div>

                {/* Empty state */}
                {orgNumbers.length === 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                        <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                        <h2 className="text-lg font-medium text-gray-900 mb-2">
                            Ingen bedrifter valgt
                        </h2>
                        <p className="text-gray-500 mb-6 max-w-md mx-auto">
                            Søk etter bedrifter og trykk på "Sammenlign"-knappen for å legge dem til her.
                        </p>
                        <Link
                            to="/utforsk"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Utforsk bedrifter
                        </Link>
                    </div>
                )}

                {/* Company grid */}
                {orgNumbers.length > 0 && (
                    <div className={`grid gap-4 ${orgNumbers.length <= 2 ? 'md:grid-cols-2' :
                        orgNumbers.length === 3 ? 'md:grid-cols-3' :
                            'md:grid-cols-2 lg:grid-cols-4'
                        }`}>
                        {data.map((item) => (
                            <ComparisonCard
                                key={item.orgnr}
                                item={item}
                                onRemove={orgNumbers.length > 1 ? handleRemove : undefined}
                            />
                        ))}
                    </div>
                )}

                {/* Tip */}
                {orgNumbers.length > 0 && orgNumbers.length < 5 && (
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-lg">
                        <p className="text-sm text-blue-800">
                            <strong>Tips:</strong> Du kan legge til opptil 5 bedrifter for sammenligning.
                            Bruk "Sammenlign"-knappen på bedriftssidene for å legge til flere.
                        </p>
                    </div>
                )}
            </div>
        </>
    )
}
