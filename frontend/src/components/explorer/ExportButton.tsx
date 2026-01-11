import { memo, useState, useCallback } from 'react'
import { Download, Loader2, Lock } from 'lucide-react'
import { useFilterParams } from '../../hooks/useFilterParams'
import { toast } from '../../store/toastStore'
import { formatNumber } from '../../utils/formatters'
import { trackEvent } from '../../utils/analytics'
import { ProFeatureModal } from '../modals'

/** Maximum rows for export */
const EXPORT_LIMIT = 1000

/**
 * Mock pro access check - replace with real auth later
 * Set to false to show paywall modal
 */
const HAS_PRO_ACCESS = false

/** Props for ExportButton component */
interface ExportButtonProps {
    /** Total count of companies matching current filters */
    totalCount?: number
}

/**
 * Custom hook to handle export logic
 */
function useExport(filterParams: Record<string, unknown>, sortBy: string, sortOrder: string) {
    const [isExporting, setIsExporting] = useState(false)

    const performExport = useCallback(async (count?: number) => {
        setIsExporting(true)

        try {
            // Build query string from filter params
            const params = new URLSearchParams()

            // Add all non-empty filter params
            Object.entries(filterParams).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    if (Array.isArray(value)) {
                        value.forEach((v) => params.append(key, String(v)))
                    } else {
                        params.append(key, String(value))
                    }
                }
            })

            // Add sort params
            params.append('sort_by', sortBy)
            params.append('sort_order', sortOrder)
            params.append('limit', String(EXPORT_LIMIT))

            // Fetch the CSV
            const response = await fetch(`/api/v1/companies/export?${params.toString()}`)

            if (!response.ok) {
                throw new Error('Export failed')
            }

            // Get the blob and trigger download
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url

            // Extract filename from Content-Disposition or use default
            const contentDisposition = response.headers.get('Content-Disposition')
            const filenameMatch = contentDisposition?.match(/filename="(.+)"/)
            link.download = filenameMatch?.[1] ?? `selskaper_${new Date().toISOString().slice(0, 10)}.csv`

            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)

            // Show success toast
            const exportedCount = count !== undefined && count > EXPORT_LIMIT ? EXPORT_LIMIT : count
            toast.success(`Eksporterte ${exportedCount !== undefined ? formatNumber(exportedCount) : ''} selskaper`)

            // Track successful export
            trackEvent('export_success', 'export', 'csv', exportedCount)
        } catch (error) {
            console.error('Export error:', error)
            toast.error('Eksport feilet. Prøv igjen.')
        } finally {
            setIsExporting(false)
        }
    }, [filterParams, sortBy, sortOrder])

    return { isExporting, performExport }
}

/**
 * Export button that downloads filtered companies as CSV.
 * Uses current filter state to generate the export URL.
 * Shows Pro modal if user doesn't have access.
 */
export const ExportButton = memo(function ExportButton({
    totalCount,
}: ExportButtonProps) {
    const [showProModal, setShowProModal] = useState(false)
    const { filterParams, sortBy, sortOrder } = useFilterParams()
    const { isExporting, performExport } = useExport(filterParams, sortBy, sortOrder)

    // Determine actual export count (capped at limit)
    const exportCount = totalCount !== undefined && totalCount > EXPORT_LIMIT ? EXPORT_LIMIT : totalCount
    const isAtLimit = totalCount !== undefined && totalCount > EXPORT_LIMIT

    const handleExportClick = useCallback(() => {
        // Track the attempt
        trackEvent('export_attempt', 'export', 'csv')

        if (HAS_PRO_ACCESS) {
            performExport(totalCount)
        } else {
            // Show paywall modal
            trackEvent('pro_feature_gate', 'export', 'csv')
            setShowProModal(true)
        }
    }, [performExport, totalCount])

    const handleProceed = useCallback(() => {
        performExport(totalCount)
    }, [performExport, totalCount])

    const handleCloseModal = useCallback(() => {
        setShowProModal(false)
    }, [])

    return (
        <>
            <button
                type="button"
                onClick={handleExportClick}
                disabled={isExporting || totalCount === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title={
                    isAtLimit
                        ? `Eksporterer første ${formatNumber(EXPORT_LIMIT)} selskaper`
                        : 'Last ned som CSV'
                }
            >
                {isExporting ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        <span className="hidden sm:inline">Eksporterer...</span>
                    </>
                ) : (
                    <>
                        {!HAS_PRO_ACCESS && <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
                        <Download className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">
                            Eksporter{exportCount !== undefined && ` (${formatNumber(exportCount)})`}
                        </span>
                    </>
                )}
            </button>

            <ProFeatureModal
                isOpen={showProModal}
                onClose={handleCloseModal}
                onProceed={handleProceed}
                featureName="export_csv"
            />
        </>
    )
})
