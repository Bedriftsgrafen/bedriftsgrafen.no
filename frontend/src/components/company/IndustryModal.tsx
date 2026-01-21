import { useState } from 'react'
import { X, Building2, Users, Loader, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { useIndustryQuery } from '../../hooks/queries/useIndustryQuery'
import { useNavigate } from '@tanstack/react-router'
import { formatNumber, cleanOrgnr } from '../../utils/formatters'

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

    const { data, isLoading, isFetching, isError, error } = useIndustryQuery({
        naceCode,
        page,
        limit: 20,
        enabled: isOpen
    })

    // Reset page when modal opens with new nace code
    const handleClose = () => {
        setPage(1)
        onClose()
    }

    const handleCompanyClick = (orgnr: string) => {
        const clean = cleanOrgnr(orgnr) || orgnr
        handleClose()
        if (onSelectCompany) {
            onSelectCompany(clean)
        } else {
            navigate({ to: '/bedrift/$orgnr', params: { orgnr: clean } })
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-3000 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={handleClose}
                onMouseDown={(e) => e.stopPropagation()}
            />

            {/* Modal */}
            <div
                className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col mx-4"
                onMouseDown={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                            <Building2 className="h-6 w-6 text-blue-600" />
                            Bransje: {naceCode}
                        </h2>
                        {naceDescription && (
                            <p className="text-sm text-gray-600 mt-1">{naceDescription}</p>
                        )}
                        {data && (
                            <p className="text-sm text-gray-500 mt-1">
                                {formatNumber(data.total)} bedrifter i denne bransjen
                            </p>
                        )}
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label="Lukk"
                    >
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading && (
                        <div className="flex items-center justify-center py-12">
                            <Loader className="h-8 w-8 animate-spin text-blue-600" />
                            <span className="ml-3 text-gray-600">Laster bedrifter...</span>
                        </div>
                    )}

                    {isError && (
                        <div className="text-center py-12">
                            <div className="text-red-600 mb-2">Kunne ikke laste bedrifter</div>
                            <div className="text-sm text-gray-500">
                                {error instanceof Error ? error.message : 'Ukjent feil'}
                            </div>
                        </div>
                    )}

                    {data && data.items.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            Ingen bedrifter funnet med denne næringskoden.
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
                                                <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                Org.nr: {company.orgnr}
                                                {company.organisasjonsform && ` • ${company.organisasjonsform}`}
                                            </div>
                                        </div>
                                        {company.antall_ansatte !== null && company.antall_ansatte !== undefined && (
                                            <div className="flex items-center gap-1 text-sm text-gray-600 ml-4">
                                                <Users className="h-4 w-4" />
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
                        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
                            <Loader className="h-6 w-6 animate-spin text-blue-600" />
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
                            <ChevronLeft className="h-4 w-4" />
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
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
