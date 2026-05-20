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
        <div className="fixed bottom-0 left-0 right-0 z-1500 border-t border-gray-200 bg-white px-4 py-3 shadow-lg dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/40">
            <div className="container mx-auto flex items-center justify-between gap-4">
                {/* Selected companies */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="shrink-0 text-sm text-gray-500 dark:text-slate-400">
                        Sammenlign ({companies.length}/3):
                    </span>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                        {companies.map((company) => (
                            <div
                                key={company.orgnr}
                                className="flex min-w-0 shrink-0 items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-sm text-blue-700 dark:bg-blue-500/15 dark:text-blue-200"
                            >
                                <span className="truncate">{company.navn}</span>
                                <button
                                    type="button"
                                    onClick={() => handleRemove(company.orgnr)}
                                    className="rounded p-0.5 hover:bg-blue-100 dark:hover:bg-blue-500/20"
                                    title="Fjern"
                                    aria-label={`Fjern ${company.navn} fra sammenligning`}
                                >
                                    <X className="h-3.5 w-3.5" aria-hidden="true" />
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
                        className="rounded-lg px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-white/10"
                    >
                        Nullstill
                    </button>
                    <button
                        type="button"
                        onClick={handleCompare}
                        disabled={companies.length < 2}
                        className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${companies.length >= 2
                            ? 'bg-blue-900 text-white hover:bg-blue-800 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400'
                            : 'cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-slate-800 dark:text-slate-600'
                            }`}
                    >
                        <BarChart3 className="h-4 w-4" aria-hidden="true" />
                        Sammenlign
                    </button>
                </div>
            </div>
        </div>
    )
})
