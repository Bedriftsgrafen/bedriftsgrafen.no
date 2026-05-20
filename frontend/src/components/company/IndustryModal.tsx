import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { X, Building2, Users, Loader, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { useIndustryQuery } from '../../hooks/queries/useIndustryQuery'
import { useNavigate } from '@tanstack/react-router'
import { formatNumber, cleanOrgnr } from '../../utils/formatters'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

interface IndustryModalProps {
    naceCode: string | null
    naceDescription?: string | null
    isOpen: boolean
    onClose: () => void
    onSelectCompany?: (orgnr: string) => void
}

export function IndustryModal({
    naceCode,
    naceDescription,
    isOpen,
    onClose,
    onSelectCompany
}: IndustryModalProps) {
    const [page, setPage] = useState(1)
    const navigate = useNavigate()
    const dialogRef = useRef<HTMLDivElement>(null)
    const closeButtonRef = useRef<HTMLButtonElement>(null)
    const previousActiveElementRef = useRef<HTMLElement | null>(null)
    const modalId = useId()
    const titleId = `${modalId}-title`
    const descriptionId = `${modalId}-description`

    const { data, isLoading, isFetching, isError, error } = useIndustryQuery({
        naceCode,
        page,
        limit: 20,
        enabled: isOpen
    })

    useBodyScrollLock(isOpen)

    // Reset page when modal opens with new nace code
    const handleClose = useCallback(() => {
        setPage(1)
        onClose()
    }, [onClose])

    useEffect(() => {
        if (!isOpen) return

        previousActiveElementRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null

        closeButtonRef.current?.focus()

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                handleClose()
                return
            }

            if (event.key !== 'Tab' || !dialogRef.current) return

            const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )

            if (focusableElements.length === 0) {
                event.preventDefault()
                dialogRef.current.focus()
                return
            }

            const firstFocusable = focusableElements[0]
            const lastFocusable = focusableElements[focusableElements.length - 1]

            if (event.shiftKey && document.activeElement === firstFocusable) {
                event.preventDefault()
                lastFocusable.focus()
                return
            }

            if (!event.shiftKey && document.activeElement === lastFocusable) {
                event.preventDefault()
                firstFocusable.focus()
            }
        }

        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.removeEventListener('keydown', handleKeyDown)

            if (previousActiveElementRef.current && document.contains(previousActiveElementRef.current)) {
                previousActiveElementRef.current.focus()
            }
        }
    }, [handleClose, isOpen])

    const handleCompanyClick = (orgnr: string) => {
        const clean = cleanOrgnr(orgnr) || orgnr
        handleClose()
        if (onSelectCompany) {
            onSelectCompany(clean)
        } else {
            navigate({ to: '/virksomhet/$orgnr', params: { orgnr: clean } })
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-3000 flex items-center justify-center" role="presentation">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={handleClose}
                aria-hidden="true"
            />

            {/* Modal */}
            <div
                ref={dialogRef}
                className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col mx-4"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={naceDescription || data ? descriptionId : undefined}
                tabIndex={-1}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <h2 id={titleId} className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Building2 className="h-6 w-6 text-blue-600" aria-hidden="true" />
                            Bransje: {naceCode}
                        </h2>
                        {(naceDescription || data) && (
                            <div id={descriptionId} className="space-y-1">
                                {naceDescription && (
                                    <p className="text-sm text-gray-600 mt-1">{naceDescription}</p>
                                )}
                                {data && (
                                    <p className="text-sm text-gray-500 mt-1">
                                        {formatNumber(data.total)} virksomheter i denne bransjen
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                    <button
                        ref={closeButtonRef}
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label="Lukk"
                    >
                        <X className="h-5 w-5 text-gray-500" aria-hidden="true" />
                    </button>
                </div>

                {/* Content */}
                <div className="relative flex-1 overflow-y-auto p-6">
                    {isLoading && (
                        <div className="flex items-center justify-center py-12" role="status" aria-live="polite">
                            <Loader className="h-8 w-8 animate-spin text-blue-600" aria-hidden="true" />
                            <span className="ml-3 text-gray-600">Laster virksomheter...</span>
                        </div>
                    )}

                    {isError && (
                        <div className="text-center py-12">
                            <div className="text-red-600 mb-2">Kunne ikke laste virksomheter</div>
                            <div className="text-sm text-gray-500">
                                {error instanceof Error ? error.message : 'Ukjent feil'}
                            </div>
                        </div>
                    )}

                    {data && data.items.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            Ingen virksomheter funnet med denne næringskoden.
                        </div>
                    )}

                    {data && data.items.length > 0 && (
                        <div className="space-y-2">
                            {data.items.map((company) => (
                                <button
                                    key={company.orgnr}
                                    onClick={() => handleCompanyClick(company.orgnr)}
                                    className="w-full text-left p-4 bg-gray-50 hover:bg-blue-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-gray-900 group-hover:text-blue-600 truncate flex items-center gap-2">
                                                {company.navn}
                                                <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" aria-hidden="true" />
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                Org.nr: {company.orgnr}
                                                {company.organisasjonsform && ` • ${company.organisasjonsform}`}
                                            </div>
                                        </div>
                                        {company.antall_ansatte !== null && company.antall_ansatte !== undefined && (
                                            <div className="flex items-center gap-1 text-sm text-gray-600 ml-4">
                                                <Users className="h-4 w-4" aria-hidden="true" />
                                                <span>{company.antall_ansatte}</span>
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Loading overlay during pagination */}
                    {isFetching && !isLoading && (
                        <div className="absolute inset-0 bg-white/50 flex items-center justify-center" role="status" aria-live="polite">
                            <Loader className="h-6 w-6 animate-spin text-blue-600" aria-hidden="true" />
                        </div>
                    )}
                </div>

                {/* Pagination Footer */}
                {data && data.pages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                            Forrige
                        </button>

                        <span className="text-sm text-gray-600">
                            Side {page} av {data.pages}
                        </span>

                        <button
                            onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                            disabled={page >= data.pages}
                            className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Neste
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
