import { memo, useCallback } from 'react'
import { X, BarChart3 } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useComparisonStore } from '../../store/comparisonStore'

/**
 * Floating bar at bottom of screen showing selected companies for comparison.
 * Only visible when at least 1 company is selected.
 */
export const ComparisonBar = memo(function ComparisonBar() {
    const companies = useComparisonStore((s) => s.companies)
    const removeCompany = useComparisonStore((s) => s.removeCompany)
    const clear = useComparisonStore((s) => s.clear)
    const navigate = useNavigate()

    const handleRemove = useCallback((orgnr: string) => {
        removeCompany(orgnr)
    }, [removeCompany])

    const handleCompare = useCallback(() => {
        // Navigate to dedicated comparison page
        navigate({
            to: '/sammenlign',
            search: { orgnr: companies.map(c => c.orgnr).join(',') }
        })
    }, [navigate, companies])

    const handleClear = useCallback(() => {
        clear()
    }, [clear])

    // Don't render if no companies selected
    if (companies.length === 0) return null

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg px-4 py-3">
            <div className="container mx-auto flex items-center justify-between gap-4">
                {/* Selected companies */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm text-gray-500 shrink-0">
                        Sammenlign ({companies.length}/3):
                    </span>
                    <div className="flex items-center gap-2 overflow-x-auto">
                        {companies.map((company) => (
                            <div
                                key={company.orgnr}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm shrink-0"
                            >
                                <span className="truncate max-w-[150px]">{company.navn}</span>
                                <button
                                    type="button"
                                    onClick={() => handleRemove(company.orgnr)}
                                    className="p-0.5 hover:bg-blue-100 rounded"
                                    title="Fjern"
                                    aria-label={`Fjern ${company.navn} fra sammenligning`}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={handleClear}
                        className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        Nullstill
                    </button>
                    <button
                        type="button"
                        onClick={handleCompare}
                        disabled={companies.length < 2}
                        className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${companies.length >= 2
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            }`}
                    >
                        <BarChart3 className="h-4 w-4" />
                        Sammenlign
                    </button>
                </div>
            </div>
        </div>
    )
})
