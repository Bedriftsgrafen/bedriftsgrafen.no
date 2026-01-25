import { createLazyFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState, useRef, startTransition, useMemo, useCallback } from 'react'
import { Building2, Users, TrendingUp, TrendingDown, Wallet, X, ArrowLeft, Share2, Crown, Swords, LayoutGrid } from 'lucide-react'
import { SEOHead } from '../components/layout'
import { apiClient } from '../utils/apiClient'
import { formatLargeNumber } from '../utils/formatters'
import { formatNace } from '../utils/nace'
import type { CompanyWithAccounting } from '../types'
import { useComparisonStore } from '../store/comparisonStore'
import { calculateComparisonMetrics, type MetricMax } from '../utils/comparison'

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

function ComparisonCard({ 
    item, 
    onRemove, 
    isWinner, 
    maxValues,
    battleMode
}: { 
    item: ComparisonData; 
    onRemove?: (orgnr: string) => void;
    isWinner: { revenue: boolean; profit: boolean; equity: boolean; employees: boolean };
    maxValues: MetricMax;
    battleMode: boolean;
}) {
    const accounting = useMemo(() => {
        if (!item.company?.regnskap || item.company.regnskap.length === 0) return null
        return [...item.company.regnskap].sort((a, b) => b.aar - a.aar)[0]
    }, [item.company])

    const getRelativeWidth = (value: number | null | undefined, max: number) => {
        if (!value || max <= 0) return '0%'
        return `${Math.min(100, (Math.abs(value) / max) * 100)}%`
    }

    return (
        <div className={`bg-white rounded-2xl border ${battleMode && Object.values(isWinner).some(Boolean) ? 'border-blue-200 shadow-md' : 'border-slate-200 shadow-sm'} p-6 space-y-5 relative transition-all duration-300 min-w-0`}>
            {onRemove && (
                <button
                    onClick={() => onRemove(item.orgnr)}
                    className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors z-10"
                    title="Fjern fra sammenligning"
                >
                    <X className="h-4 w-4" />
                </button>
            )}

            {!item.company && item.loading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <Building2 className="h-8 w-8 text-slate-200 animate-pulse" />
                    <div className="space-y-2 w-full">
                        <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4 mx-auto" />
                        <div className="h-3 bg-slate-50 rounded animate-pulse w-1/2 mx-auto" />
                    </div>
                </div>
            ) : item.company ? (
                <>
                    {/* Company header */}
                    <div className="pr-8 min-w-0">
                        <Link
                            to="/bedrift/$orgnr"
                            params={{ orgnr: item.orgnr }}
                            className="text-lg font-bold text-gray-900 hover:text-blue-600 line-clamp-2 transition-colors leading-tight"
                        >
                            {item.company.navn}
                        </Link>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.15em] mt-1 truncate" title={`${item.company.organisasjonsform} • ${item.orgnr}`}>
                            {item.company.organisasjonsform} • {item.orgnr}
                        </p>
                    </div>

                    {/* Basic info */}
                    <div className="space-y-4 min-w-0">
                        <div className="flex items-start gap-2 text-sm min-w-0">
                            <Building2 className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                                <span className="block line-clamp-2 text-slate-600 font-medium leading-snug" title={formatNace(item.company.naeringskode)}>
                                    {formatNace(item.company.naeringskode) || 'Ukjent bransje'}
                                </span>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-1.5 min-w-0">
                                    <div className="flex items-center gap-2 text-slate-500 min-w-0">
                                        <Users className="h-4 w-4 text-slate-300 shrink-0" />
                                        <span className="truncate">Ansatte</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className={`font-bold ${battleMode && isWinner.employees ? 'text-blue-600' : 'text-slate-900'}`}>
                                            {item.company.antall_ansatte ?? '-'}
                                        </span>
                                        {battleMode && isWinner.employees && (
                                            <Crown 
                                                className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" 
                                                aria-hidden="true"
                                            />
                                        )}
                                    </div>
                                </div>
                            {battleMode && (
                                <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full transition-all duration-1000 ${isWinner.employees ? 'bg-blue-500' : 'bg-slate-300'}`}
                                        style={{ width: getRelativeWidth(item.company.antall_ansatte, maxValues.employees) }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Financial data */}
                    {accounting ? (
                        <div className="space-y-5 pt-5 border-t border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                REGNSKAP {accounting.aar}
                            </p>

                            {/* Revenue */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-1.5 text-sm min-w-0">
                                    <div className="flex items-center gap-2 text-slate-500 min-w-0">
                                        <TrendingUp className="h-4 w-4 text-blue-400 shrink-0" />
                                        <span className="truncate">Omsetning</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className={`font-bold ${battleMode && isWinner.revenue ? 'text-blue-600' : 'text-slate-900'}`}>
                                            {formatLargeNumber(accounting.salgsinntekter)}
                                        </span>
                                        {battleMode && isWinner.revenue && (
                                            <Crown 
                                                className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" 
                                                aria-hidden="true"
                                            />
                                        )}
                                    </div>
                                </div>
                                {battleMode && (
                                    <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-1000 ${isWinner.revenue ? 'bg-blue-500' : 'bg-slate-300'}`}
                                            style={{ width: getRelativeWidth(accounting.salgsinntekter, maxValues.revenue) }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Result */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-1.5 text-sm min-w-0">
                                    <div className="flex items-center gap-2 text-slate-500 min-w-0">
                                        {(accounting.aarsresultat ?? 0) >= 0 ? (
                                            <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" />
                                        ) : (
                                            <TrendingDown className="h-4 w-4 text-rose-400 shrink-0" />
                                        )}
                                        <span className="truncate">Resultat</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className={`font-bold ${(accounting.aarsresultat ?? 0) >= 0
                                            ? (battleMode && isWinner.profit ? 'text-emerald-600' : 'text-slate-900')
                                            : 'text-rose-600'
                                            }`}>
                                            {formatLargeNumber(accounting.aarsresultat)}
                                        </span>
                                        {battleMode && isWinner.profit && (
                                            <Crown 
                                                className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" 
                                                aria-hidden="true"
                                            />
                                        )}
                                    </div>
                                </div>
                                {battleMode && (
                                    <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-1000 ${isWinner.profit ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                            style={{ width: getRelativeWidth(accounting.aarsresultat, maxValues.profit) }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Equity */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-1.5 text-sm min-w-0">
                                    <div className="flex items-center gap-2 text-slate-500 min-w-0">
                                        <Wallet className="h-4 w-4 text-indigo-400 shrink-0" />
                                        <span className="truncate">Egenkapital</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className={`font-bold ${battleMode && isWinner.equity ? 'text-indigo-600' : 'text-slate-900'}`}>
                                            {formatLargeNumber(accounting.egenkapital)}
                                        </span>
                                        {battleMode && isWinner.equity && (
                                            <Crown 
                                                className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" 
                                                aria-hidden="true"
                                            />
                                        )}
                                    </div>
                                </div>
                                {battleMode && (
                                    <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-1000 ${isWinner.equity ? 'bg-indigo-500' : 'bg-slate-300'}`}
                                            style={{ width: getRelativeWidth(accounting.egenkapital, maxValues.equity) }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Ingen regnskapsdata
                            </p>
                        </div>
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
    const [battleMode, setBattleMode] = useState(false)
    const fetchIdRef = useRef(0)

    // Determine which org numbers to use (URL params take priority, then store)
    const orgNumbers = useMemo(() => {
        if (orgnrParam) {
            return orgnrParam.split(',').filter(Boolean).slice(0, 5) // Max 5
        }
        return storeCompanies.map(c => c.orgnr)
    }, [orgnrParam, storeCompanies])

    // Calculate winners and max values
    const { winners, maxValues } = useMemo(() => {
        return calculateComparisonMetrics(data)
    }, [data])

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

            <div className="max-w-7xl mx-auto px-4 pb-20">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div className="flex items-center gap-6">
                        <Link
                            to="/"
                            className="p-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl transition-all shadow-sm group"
                            title="Tilbake"
                            aria-label="Tilbake til forsiden"
                        >
                            <ArrowLeft className="h-5 w-5 text-slate-600 group-hover:-translate-x-1 transition-transform" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                                Sammenligning
                            </h1>
                            <p className="text-sm font-medium text-slate-400 mt-1">
                                {orgNumbers.length} bedrift{orgNumbers.length > 1 ? 'er' : ''} i utvalget
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Battle Mode Toggle */}
                        {orgNumbers.length > 1 && (
                            <button
                                onClick={() => setBattleMode(!battleMode)}
                                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-sm border ${
                                    battleMode 
                                    ? 'bg-blue-600 text-white border-blue-500 shadow-blue-200' 
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                            >
                                {battleMode ? <LayoutGrid className="h-4 w-4" /> : <Swords className="h-4 w-4" />}
                                {battleMode ? 'Standard visning' : 'Battle Mode'}
                            </button>
                        )}

                        {orgNumbers.length > 0 && (
                            <button
                                onClick={handleShare}
                                className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm"
                            >
                                <Share2 className="h-4 w-4" />
                                Del utvalg
                            </button>
                        )}
                    </div>
                </div>

                {/* Empty state */}
                {orgNumbers.length === 0 && (
                    <div className="bg-white rounded-3xl border border-slate-200 p-20 text-center shadow-sm">
                        <div className="h-20 w-20 bg-slate-50 text-slate-400 rounded-3xl flex items-center justify-center mx-auto mb-6">
                            <Building2 className="h-10 w-10" />
                        </div>
                        <h2 className="text-2xl font-black text-slate-900 mb-3">
                            Ingen bedrifter valgt
                        </h2>
                        <p className="text-slate-500 mb-8 max-w-md mx-auto font-medium">
                            Søk etter bedrifter og bruk "Sammenlign"-knappen for å sette opp en analyse.
                        </p>
                        <Link
                            to="/utforsk"
                            className="inline-flex items-center gap-2 px-8 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-blue-600 transition-all shadow-xl"
                        >
                            Finn bedrifter
                        </Link>
                    </div>
                )}

                {/* Company grid */}
                {orgNumbers.length > 0 && (
                    <div className="relative">
                        <div className={`grid gap-6 ${orgNumbers.length <= 2 ? 'md:grid-cols-2 max-w-4xl mx-auto' :
                            orgNumbers.length === 3 ? 'lg:grid-cols-3' :
                                'md:grid-cols-2 lg:grid-cols-4'
                            }`}>
                            {data.map((item, idx) => (
                                <div key={item.orgnr} className="relative group min-w-0">
                                    <ComparisonCard
                                        item={item}
                                        onRemove={orgNumbers.length > 1 ? handleRemove : undefined}
                                        maxValues={maxValues}
                                        battleMode={battleMode}
                                        isWinner={{
                                            revenue: winners.revenue === item.orgnr,
                                            profit: winners.profit === item.orgnr,
                                            equity: winners.equity === item.orgnr,
                                            employees: winners.employees === item.orgnr
                                        }}
                                    />
                                    {/* VS Badge between cards only in Battle Mode */}
                                    {battleMode && idx < data.length - 1 && (
                                        <div className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-8 h-8 bg-blue-600 text-white rounded-full shadow-xl border-4 border-white pointer-events-none italic">
                                            <Swords className="h-3 w-3" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Battle Mode Tip - Only shown when Battle Mode is OFF */}
                {orgNumbers.length > 1 && !battleMode && (
                    <div className="mt-12 p-8 bg-slate-100/50 border border-slate-200 rounded-3xl flex items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                            <div className="h-12 w-12 bg-white text-slate-400 rounded-2xl flex items-center justify-center shadow-sm">
                                <Swords className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-slate-900 font-bold">Ønsker du en mer visuell duell?</p>
                                <p className="text-sm text-slate-500 font-medium">Aktiver "Battle Mode" for å kåre vinnere og se relative forskjeller i nøkkeltall.</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setBattleMode(true)}
                            className="px-6 py-3 bg-white border border-slate-200 text-slate-900 font-bold rounded-xl hover:bg-white hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm"
                        >
                            Prøv Battle Mode
                        </button>
                    </div>
                )}
            </div>
        </>
    )
}
