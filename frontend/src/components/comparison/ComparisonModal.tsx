import { memo, useCallback, useEffect, useState, useRef, startTransition, useMemo, useId } from 'react'
import { Building2, Users, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { useComparisonStore } from '../../store/comparisonStore'
import { Modal } from '../common'
import { Button } from '../common/Button'
import { apiClient } from '../../utils/apiClient'
import { formatLargeNumber } from '../../utils/formatters'
import { formatNace } from '../../utils/nace'
import type { CompanyWithAccounting } from '../../types'
import { AffiliateBanner } from '../ads/AffiliateBanner'
import { AFFILIATIONS } from '../../constants/affiliations'

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
        <div className="bg-gray-50 rounded-lg p-4 space-y-4 min-w-0">
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
                    <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 line-clamp-2">
                            {item.company.navn}
                        </h3>
                        <p className="text-sm text-gray-500 truncate" title={`${item.company.organisasjonsform} • ${item.orgnr}`}>
                            {item.company.organisasjonsform} • {item.orgnr}
                        </p>
                    </div>

                    {/* Basic info */}
                    <div className="space-y-2 min-w-0">
                        <div className="flex items-start gap-2 text-sm min-w-0">
                            <Building2 className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                                <span className="block line-clamp-2 text-gray-600 leading-snug" title={formatNace(item.company.naeringskode)}>
                                    {formatNace(item.company.naeringskode) || 'Ukjent bransje'}
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <Users className="h-4 w-4 text-gray-400" aria-hidden="true" />
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
                                    <TrendingUp className="h-4 w-4 text-blue-500" aria-hidden="true" />
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
                                        <TrendingUp className="h-4 w-4 text-green-500" aria-hidden="true" />
                                    ) : (
                                        <TrendingDown className="h-4 w-4 text-red-500" aria-hidden="true" />
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
                                    <Wallet className="h-4 w-4 text-purple-500" aria-hidden="true" />
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
    const modalId = useId()

    const [data, setData] = useState<ComparisonData[]>([])
    const fetchIdRef = useRef(0)
    const titleId = `${modalId}-title`
    const descriptionId = `${modalId}-description`

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

    if (!isOpen) return null

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            maxWidth="max-w-5xl"
            padding={false}
            ariaLabelledBy={titleId}
            ariaDescribedBy={descriptionId}
        >
            <div className="max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 pr-14 sm:pr-16 border-b border-gray-200">
                    <div className="min-w-0">
                        <h2 id={titleId} className="text-lg sm:text-xl font-semibold text-gray-900 flex-1 min-w-0 truncate">
                            Sammenligning av {companies.length} virksomheter
                        </h2>
                        <p id={descriptionId} className="mt-1 text-sm text-gray-500">
                            Sammenlign nøkkeltall og siste tilgjengelige regnskap side ved side.
                        </p>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4 sm:p-6">
                    {/* Company comparison grid */}
                    <div className={`grid gap-3 sm:gap-4 ${companies.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
                        {data.map((item) => (
                            <ComparisonCard key={item.orgnr} item={item} />
                        ))}
                    </div>

                    {/* Affiliate Banner */}
                    <div className="mt-8">
                        <AffiliateBanner
                            bannerId={`comparison_${AFFILIATIONS.ZENSUM_LOAN.id}`}
                            placement="comparison_modal"
                            legalTextMode="inline"
                            {...AFFILIATIONS.ZENSUM_LOAN}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-4 sm:px-6 py-4 border-t border-gray-200 bg-gray-50">
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
        </Modal>
    )
})
