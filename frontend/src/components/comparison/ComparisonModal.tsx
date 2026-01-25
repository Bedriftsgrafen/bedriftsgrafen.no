import { memo, useCallback, useEffect, useState, useRef, startTransition, useMemo } from 'react'
import { X, Building2, Users, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { useComparisonStore } from '../../store/comparisonStore'
import { Button } from '../common/Button'
import { apiClient } from '../../utils/apiClient'
import { formatLargeNumber } from '../../utils/formatters'
import { formatNace } from '../../utils/nace'
import type { CompanyWithAccounting } from '../../types'
import { AffiliateBanner } from '../ads/AffiliateBanner'
import { CONTACT_EMAIL } from '../../constants/contact'

/** Fetched company data for comparison */
interface ComparisonData {
    orgnr: string
    company: CompanyWithAccounting | null
    loading: boolean
    error: string | null
}

const ComparisonCard = memo(function ComparisonCard({ item }: { item: ComparisonData }) {
    const accounting = useMemo(() => {
        if (!item.company?.regnskap || item.company.regnskap.length === 0) return null
        return [...item.company.regnskap].sort((a, b) => b.aar - a.aar)[0]
    }, [item.company])

    return (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            {item.loading ? (
                <div className="animate-pulse space-y-3">
                    <div className="h-6 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="h-20 bg-gray-200 rounded" />
                </div>
            ) : item.error ? (
                <div className="text-red-500 text-sm">{item.error}</div>
            ) : item.company ? (
                <>
                    {/* Company header */}
                    <div>
                        <h3 className="font-semibold text-gray-900 line-clamp-2">
                            {item.company.navn}
                        </h3>
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
                        <div className="space-y-3 pt-2 border-t border-gray-200">
                            <p className="text-xs text-gray-400">
                                Regnskap {accounting.aar}
                            </p>

                            {/* Revenue */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <TrendingUp className="h-4 w-4 text-blue-500" />
                                    Omsetning
                                </div>
                                <span className="font-medium text-gray-900">
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
                                <span className={`font-medium ${(accounting.aarsresultat ?? 0) >= 0
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
                                <span className="font-medium text-gray-900">
                                    {formatLargeNumber(accounting.egenkapital)}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 pt-2 border-t border-gray-200">
                            Ingen regnskapsdata
                        </p>
                    )}
                </>
            ) : null}
        </div>
    )
})

/**
 * Modal showing side-by-side comparison of selected companies.
 */
export const ComparisonModal = memo(function ComparisonModal() {
    const isOpen = useComparisonStore((s) => s.isModalOpen)
    const companies = useComparisonStore((s) => s.companies)
    const closeModal = useComparisonStore((s) => s.closeModal)
    const clear = useComparisonStore((s) => s.clear)

    const [data, setData] = useState<ComparisonData[]>([])
    const fetchIdRef = useRef(0)

    // Fetch company data when modal opens
    useEffect(() => {
        if (!isOpen || companies.length < 2) {
            startTransition(() => setData([]))
            return
        }

        const fetchId = ++fetchIdRef.current

        // Create loading state
        const loadingState: ComparisonData[] = companies.map((c) => ({
            orgnr: c.orgnr,
            company: null,
            loading: true,
            error: null,
        }))

        startTransition(() => setData(loadingState))

        // Fetch data
        Promise.all(
            companies.map(async (c) => {
                try {
                    const response = await apiClient.get<CompanyWithAccounting>(
                        `/v1/companies/${c.orgnr}`
                    )
                    return {
                        orgnr: c.orgnr,
                        company: response.data,
                        loading: false,
                        error: null,
                    }
                } catch {
                    return {
                        orgnr: c.orgnr,
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
    }, [isOpen, companies])

    const handleClose = useCallback(() => {
        closeModal()
    }, [closeModal])

    const handleCloseAndClear = useCallback(() => {
        closeModal()
        clear()
    }, [closeModal, clear])

    // Handle escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose()
        }
        if (isOpen) {
            window.addEventListener('keydown', handleEsc)
            return () => window.removeEventListener('keydown', handleEsc)
        }
    }, [isOpen, handleClose])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div
                className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Sammenligning av {companies.length} bedrifter
                    </h2>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {/* Company comparison grid */}
                    <div className={`grid gap-4 ${companies.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                        {data.map((item) => (
                            <ComparisonCard key={item.orgnr} item={item} />
                        ))}
                    </div>

                    {/* Affiliate Banner - Banking */}
                    <div className="mt-8">
                        <AffiliateBanner
                            bannerId="banking_comparison_modal"
                            placement="comparison_modal"
                            title="Vil du nå bedrifter i vekst?"
                            description={`Denne plassen er ledig for en bankpartner. Kontakt oss på ${CONTACT_EMAIL} for samarbeid.`}
                            buttonText="Send e-post"
                            link={`mailto:${CONTACT_EMAIL}`}
                            icon={Wallet}
                            variant="banking"
                            isPlaceholder
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <Button
                        type="button"
                        onClick={handleCloseAndClear}
                        variant="ghost"
                        size="sm"
                    >
                        Lukk og nullstill
                    </Button>
                    <Button
                        type="button"
                        onClick={handleClose}
                        variant="primary"
                        size="sm"
                    >
                        Lukk
                    </Button>
                </div>
            </div>
        </div>
    )
})
