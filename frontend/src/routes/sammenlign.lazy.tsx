/* eslint-disable react-refresh/only-export-components */
import { createLazyFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState, useRef, startTransition, useMemo, useCallback } from 'react'
import { Building2, Users, TrendingUp, TrendingDown, Wallet, X, ArrowLeft, Share2, Crown, Swords, LayoutGrid, ArrowRight, Search, MapPin, ArrowLeftRight } from 'lucide-react'
import { SEOHead } from '../components/layout'
import { apiClient } from '../utils/apiClient'
import { formatLargeNumber } from '../utils/formatters'
import { formatNace } from '../utils/nace'
import { copyToClipboard } from '../utils/clipboard'
import type { CompanyWithAccounting } from '../types'
import { useComparisonStore } from '../store/comparisonStore'
import { toast } from '../store/toastStore'
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

const MAX_COMPARISON_URL_ORG_NUMBERS = 5
const COMPARISON_ORGNR_PATTERN = /^\d{9}$/
const ENERGY_COMPARISON_ORG_NUMBERS = ['923609016', '989795848', '919160675'] as const

export function parseComparisonOrgNumbers(orgnrParam: string | undefined): string[] {
    if (!orgnrParam) return []

    const orgNumbers: string[] = []
    for (const candidate of orgnrParam.split(',')) {
        const orgnr = candidate.trim().replace(/^['"]|['"]$/g, '')
        if (!COMPARISON_ORGNR_PATTERN.test(orgnr) || orgNumbers.includes(orgnr)) continue

        orgNumbers.push(orgnr)
        if (orgNumbers.length >= MAX_COMPARISON_URL_ORG_NUMBERS) break
    }

    return orgNumbers
}

function getComparisonOrgParam(orgNumbers: readonly string[]): string {
    return orgNumbers.join(',')
}

export function getComparisonShareUrl(origin: string, orgNumbers: string[]): string {
    const params = new URLSearchParams({ orgnr: orgNumbers.join(',') })
    return `${origin}/sammenlign?${params.toString()}`
}

function ComparisonEmptyState() {
    return (
        <section
            aria-labelledby="comparison-empty-title"
            className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/30 md:rounded-3xl md:p-10"
        >
            <div className="mx-auto max-w-3xl text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-900 ring-1 ring-blue-100 dark:bg-blue-400/10 dark:text-blue-200 dark:ring-blue-300/20">
                    <ArrowLeftRight className="h-8 w-8" aria-hidden="true" />
                </div>
                <h2 id="comparison-empty-title" className="text-2xl font-black tracking-tight text-slate-900 dark:text-white md:text-3xl">
                    Velg virksomheter å sammenligne
                </h2>
                <p className="mx-auto mt-3 max-w-2xl text-base font-medium leading-7 text-slate-600 dark:text-slate-300">
                    Start med et ferdig eksempel, finn egne kandidater med filtrene, eller åpne en virksomhetsside og legg selskapet til sammenligning derfra.
                </p>
            </div>

            <div className="mt-8 grid min-w-0 gap-4 md:grid-cols-3">
                <Link
                    to="/sammenlign"
                    search={{ orgnr: getComparisonOrgParam(ENERGY_COMPARISON_ORG_NUMBERS) }}
                    className="group flex min-w-0 flex-col rounded-2xl border border-blue-200 bg-blue-50/70 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-blue-300/30 dark:bg-blue-500/10 dark:hover:border-blue-300/50 dark:hover:bg-blue-500/15 dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-900"
                >
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-blue-900 shadow-sm ring-1 ring-blue-100 dark:bg-blue-300/10 dark:text-blue-200 dark:ring-blue-300/20">
                        <ArrowLeftRight className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span className="text-base font-bold leading-snug text-slate-950 dark:text-white">
                        Sammenlign Equinor, Aker BP og Vår Energi
                    </span>
                    <span className="mt-2 flex-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Åpner tre verifiserte energiaktører side ved side med siste tilgjengelige regnskap.
                    </span>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-blue-900 dark:text-blue-200">
                        Åpne eksempel
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                </Link>

                <Link
                    to="/utforsk"
                    className="group flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-800/70 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-900"
                >
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">
                        <MapPin className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span className="text-base font-bold leading-snug text-slate-950 dark:text-white">
                        Finn konkurrenter i samme kommune
                    </span>
                    <span className="mt-2 flex-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Bruk kommune, bransje og størrelse i utforskeren, og legg aktuelle virksomheter til sammenligning.
                    </span>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                        Åpne utforsker
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                </Link>

                <Link
                    to="/virksomhet/$orgnr"
                    params={{ orgnr: '984661185' }}
                    className="group flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-slate-50/80 p-5 text-left transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-800/70 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-900"
                >
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-700">
                        <Search className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <span className="text-base font-bold leading-snug text-slate-950 dark:text-white">
                        Start fra en virksomhetsside
                    </span>
                    <span className="mt-2 flex-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Åpne Posten Bring som eksempel, finn sammenligningsknappen og bygg et eget utvalg.
                    </span>
                    <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                        Åpne virksomhet
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                </Link>
            </div>
        </section>
    )
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
        <div className={`rounded-2xl border bg-white p-6 space-y-5 relative transition-all duration-300 min-w-0 dark:bg-slate-900 dark:shadow-black/30 ${battleMode && Object.values(isWinner).some(Boolean) ? 'border-blue-200 shadow-md dark:border-blue-300/35' : 'border-slate-200 shadow-sm dark:border-slate-800'}`}>
            {onRemove && (
                <button
                    type="button"
                    onClick={() => onRemove(item.orgnr)}
                    className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors z-10 dark:text-slate-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                    title="Fjern fra sammenligning"
                    aria-label="Fjern fra sammenligning"
                >
                    <X className="h-4 w-4" aria-hidden="true" />
                </button>
            )}

            {!item.company && item.loading ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <Building2 className="h-8 w-8 text-slate-200 animate-pulse dark:text-slate-700" aria-hidden="true" />
                    <div className="space-y-2 w-full">
                        <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4 mx-auto dark:bg-slate-800" />
                        <div className="h-3 bg-slate-50 rounded animate-pulse w-1/2 mx-auto dark:bg-slate-800/70" />
                    </div>
                </div>
            ) : item.company ? (
                <>
                    {/* Company header */}
                    <div className="pr-8 min-w-0">
                        <Link
                            to="/virksomhet/$orgnr"
                            params={{ orgnr: item.orgnr }}
                            className="text-lg font-bold text-gray-900 hover:text-blue-600 line-clamp-2 transition-colors leading-tight dark:text-white dark:hover:text-blue-300"
                        >
                            {item.company.navn}
                        </Link>
                        <p className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.15em] text-gray-600 dark:text-slate-400" title={`${item.company.organisasjonsform} • ${item.orgnr}`}>
                            {item.company.organisasjonsform} • {item.orgnr}
                        </p>
                    </div>

                    {/* Basic info */}
                    <div className="space-y-4 min-w-0">
                        <div className="flex items-start gap-2 text-sm min-w-0">
                            <Building2 className="h-4 w-4 text-slate-300 shrink-0 mt-0.5 dark:text-slate-500" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                                <span className="block line-clamp-2 text-slate-600 font-medium leading-snug dark:text-slate-300" title={formatNace(item.company.naeringskode)}>
                                    {formatNace(item.company.naeringskode) || 'Ukjent bransje'}
                                </span>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-1.5 min-w-0">
                                <div className="flex items-center gap-2 text-slate-500 min-w-0 dark:text-slate-400">
                                    <Users className="h-4 w-4 text-slate-300 shrink-0 dark:text-slate-500" aria-hidden="true" />
                                    <span className="truncate">Ansatte</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <span className={`font-bold ${battleMode && isWinner.employees ? 'text-blue-600 dark:text-blue-300' : 'text-slate-900 dark:text-slate-100'}`}>
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
                                <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden dark:bg-slate-800">
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
                        <div className="space-y-5 pt-5 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400">
                                REGNSKAP {accounting.aar}
                            </p>

                            {/* Revenue */}
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-1.5 text-sm min-w-0">
                                    <div className="flex items-center gap-2 text-slate-500 min-w-0 dark:text-slate-400">
                                        <TrendingUp className="h-4 w-4 text-blue-400 shrink-0" aria-hidden="true" />
                                        <span className="truncate">Omsetning</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className={`font-bold ${battleMode && isWinner.revenue ? 'text-blue-600 dark:text-blue-300' : 'text-slate-900 dark:text-slate-100'}`}>
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
                                    <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden dark:bg-slate-800">
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
                                    <div className="flex items-center gap-2 text-slate-500 min-w-0 dark:text-slate-400">
                                        {(accounting.aarsresultat ?? 0) >= 0 ? (
                                            <TrendingUp className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />
                                        ) : (
                                            <TrendingDown className="h-4 w-4 text-rose-400 shrink-0" aria-hidden="true" />
                                        )}
                                        <span className="truncate">Resultat</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className={`font-bold ${(accounting.aarsresultat ?? 0) >= 0
                                            ? (battleMode && isWinner.profit ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-900 dark:text-slate-100')
                                            : 'text-rose-600 dark:text-rose-300'
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
                                    <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden dark:bg-slate-800">
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
                                    <div className="flex items-center gap-2 text-slate-500 min-w-0 dark:text-slate-400">
                                        <Wallet className="h-4 w-4 text-indigo-400 shrink-0" aria-hidden="true" />
                                        <span className="truncate">Egenkapital</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <span className={`font-bold ${battleMode && isWinner.equity ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-900 dark:text-slate-100'}`}>
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
                                    <div className="w-full bg-slate-100 rounded-full h-1 overflow-hidden dark:bg-slate-800">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ${isWinner.equity ? 'bg-indigo-500' : 'bg-slate-300'}`}
                                            style={{ width: getRelativeWidth(accounting.egenkapital, maxValues.equity) }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 dark:bg-slate-950">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
                                Ingen regnskapsdata
                            </p>
                        </div>
                    )}
                </>
            ) : item.error ? (
                <div
                    role="alert"
                    data-testid="comparison-error-card"
                    className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-rose-200 bg-rose-50 px-5 py-8 text-center dark:border-rose-300/25 dark:bg-rose-500/10"
                >
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-rose-700 ring-1 ring-rose-100 dark:bg-rose-300/10 dark:text-rose-200 dark:ring-rose-300/20">
                        <Building2 className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <p className="text-base font-bold text-slate-950 dark:text-white">
                        Kunne ikke hente virksomheten
                    </p>
                    <p className="mt-2 max-w-56 text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Org.nr. {item.orgnr} svarte ikke med gyldige data. Prøv et annet selskap eller åpne utforskeren.
                    </p>
                    <Link
                        to="/utforsk"
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-900 shadow-sm ring-1 ring-slate-200 transition-colors hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-900"
                    >
                        Finn virksomhet
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </div>
            ) : null}
        </div>
    )
}

export function ComparisonPage() {
    const { orgnr: orgnrParam } = Route.useSearch()
    const navigate = Route.useNavigate()

    // Get companies from store (for when navigating from ComparisonBar)
    const storeCompanies = useComparisonStore((s) => s.companies)
    const clearStore = useComparisonStore((s) => s.clear)

    const [data, setData] = useState<ComparisonData[]>([])
    const [battleMode, setBattleMode] = useState(false)
    const [shareFeedback, setShareFeedback] = useState<'idle' | 'success' | 'error'>('idle')
    const fetchIdRef = useRef(0)
    const shareFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const urlOrgNumbers = useMemo(() => parseComparisonOrgNumbers(orgnrParam), [orgnrParam])

    const storeOrgNumbers = useMemo(
        () => parseComparisonOrgNumbers(storeCompanies.map((company) => company.orgnr).join(',')),
        [storeCompanies],
    )

    // Determine which org numbers to use (URL params take priority, then store)
    const orgNumbers = useMemo(() => {
        if (orgnrParam && urlOrgNumbers.length > 0) {
            return urlOrgNumbers
        }
        return storeOrgNumbers
    }, [orgnrParam, storeOrgNumbers, urlOrgNumbers])

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
        const loadingState: ComparisonData[] = orgNumbers.map((orgnr: string) => ({
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
        const existing = orgNumbers.filter((orgnr: string) => orgnr !== orgnrToRemove)
        if (existing.length === 0) {
            clearStore()
            navigate({ to: '/' })
        } else {
            navigate({
                to: '/sammenlign',
                search: { orgnr: existing.join(',') },
                replace: true,
            })
        }
    }, [orgNumbers, clearStore, navigate])

    const showShareFeedback = useCallback((status: 'success' | 'error') => {
        setShareFeedback(status)

        if (shareFeedbackTimeoutRef.current) {
            clearTimeout(shareFeedbackTimeoutRef.current)
        }

        shareFeedbackTimeoutRef.current = setTimeout(() => {
            setShareFeedback('idle')
            shareFeedbackTimeoutRef.current = null
        }, 3500)
    }, [])

    // Share URL
    const handleShare = useCallback(async () => {
        const url = getComparisonShareUrl(window.location.origin, orgNumbers)
        const copied = await copyToClipboard(url)

        if (copied) {
            toast.success('Lenke til sammenligningen er kopiert')
            showShareFeedback('success')
            return
        }

        toast.error('Kunne ikke kopiere lenken automatisk')
        showShareFeedback('error')

        if (typeof window.prompt === 'function') {
            window.prompt('Kopier lenken:', url)
        }
    }, [orgNumbers, showShareFeedback])

    useEffect(() => {
        return () => {
            if (shareFeedbackTimeoutRef.current) {
                clearTimeout(shareFeedbackTimeoutRef.current)
            }
        }
    }, [])

    // Sync URL params when coming from store
    useEffect(() => {
        if ((!orgnrParam || urlOrgNumbers.length === 0) && storeOrgNumbers.length > 0) {
            navigate({
                to: '/sammenlign',
                search: { orgnr: getComparisonOrgParam(storeOrgNumbers) },
                replace: true
            })
        }
    }, [orgnrParam, storeOrgNumbers, urlOrgNumbers.length, navigate])

    return (
        <>
            <SEOHead
                title="Sammenlign virksomheter - Bedriftsgrafen.no"
                description="Sammenlign nøkkeltall og økonomi mellom norske virksomheter side ved side."
            />

            <div className="max-w-7xl mx-auto px-4 pb-20">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div className="flex items-center gap-6">
                        <Link
                            to="/"
                            className="p-3 bg-white border border-slate-200 hover:bg-slate-50 rounded-2xl transition-all shadow-sm group dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 dark:shadow-black/20"
                            title="Tilbake"
                            aria-label="Tilbake til forsiden"
                        >
                            <ArrowLeft className="h-5 w-5 text-slate-600 group-hover:-translate-x-1 transition-transform dark:text-slate-200" aria-hidden="true" />
                        </Link>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight dark:text-white">
                                Sammenligning
                            </h1>
                            <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">
                                {orgNumbers.length} virksomhet{orgNumbers.length > 1 ? 'er' : ''} i utvalget
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-start gap-2 md:items-end">
                        <div className="flex items-center gap-3">
                            {/* Battle Mode Toggle */}
                            {orgNumbers.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => setBattleMode(!battleMode)}
                                    className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-sm border ${battleMode
                                        ? 'bg-blue-900 text-white border-blue-800 shadow-blue-200 dark:border-blue-300/30 dark:bg-blue-500 dark:text-slate-950 dark:shadow-black/20'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    {battleMode ? <LayoutGrid className="h-4 w-4" aria-hidden="true" /> : <Swords className="h-4 w-4" aria-hidden="true" />}
                                    {battleMode ? 'Standard visning' : 'Duellvisning'}
                                </button>
                            )}

                            {orgNumbers.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleShare}
                                    className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-slate-700 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                                >
                                    <Share2 className="h-4 w-4" aria-hidden="true" />
                                    {shareFeedback === 'success' ? 'Lenke kopiert' : 'Del utvalg'}
                                </button>
                            )}
                        </div>

                        <p className="min-h-5 text-sm font-medium text-slate-500 dark:text-slate-400" role="status" aria-live="polite">
                            {shareFeedback === 'success' && 'Lenken er kopiert til utklippstavlen.'}
                            {shareFeedback === 'error' && 'Kunne ikke kopiere automatisk. Kopier lenken fra dialogen.'}
                        </p>
                    </div>
                </div>

                {/* Empty state */}
                {orgNumbers.length === 0 && (
                    <ComparisonEmptyState />
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
                                                            <div className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 items-center justify-center w-8 h-8 bg-blue-900 text-white rounded-full shadow-xl border-4 border-white pointer-events-none italic dark:border-slate-950 dark:bg-blue-500 dark:text-slate-950">
                                            <Swords className="h-3 w-3" aria-hidden="true" />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Battle Mode Tip - Only shown when Battle Mode is OFF */}
                {orgNumbers.length > 1 && !battleMode && (
                    <div className="mt-8 md:mt-12 p-5 md:p-8 bg-slate-100/50 border border-slate-200 rounded-2xl md:rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 md:gap-6 dark:border-slate-800 dark:bg-slate-900/80">
                        <div className="flex items-center gap-5">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm dark:bg-slate-950 dark:text-slate-200 dark:ring-1 dark:ring-slate-800">
                                <Swords className="h-6 w-6" aria-hidden="true" />
                            </div>
                            <div>
                                <p className="text-slate-900 font-bold dark:text-white">Ønsker du en mer visuell duell?</p>
                                <p className="text-sm text-slate-500 font-medium dark:text-slate-300">Aktiver duellvisning for å kåre vinnere og se relative forskjeller i nøkkeltall.</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setBattleMode(true)}
                            className="px-6 py-3 bg-white border border-slate-200 text-slate-900 font-bold rounded-xl hover:bg-white hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-blue-300 dark:hover:bg-slate-900 dark:hover:text-blue-200"
                        >
                            Prøv duellvisning
                        </button>
                    </div>
                )}
            </div>
        </>
    )
}
