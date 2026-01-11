import { AlertCircle, RefreshCw } from 'lucide-react'

interface ErrorStateProps {
    title?: string
    message?: string
    onRetry?: () => void
    className?: string
}

export function ErrorState({
    title = 'Noe gikk galt',
    message = 'Kunne ikke laste innholdet. Vennligst prøv igjen.',
    onRetry,
    className = ''
}: ErrorStateProps) {
    return (
        <div className={`bg-red-50 border border-red-200 rounded-xl p-6 text-center ${className}`}>
            <div className="flex flex-col items-center gap-2">
                <AlertCircle className="h-8 w-8 text-red-500" />
                <h3 className="text-red-900 font-medium">{title}</h3>
                <p className="text-red-700 text-sm mb-2">{message}</p>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="flex items-center gap-2 px-4 py-2 bg-white text-red-700 text-sm font-medium rounded-lg border border-red-200 hover:bg-red-50 hover:border-red-300 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Prøv igjen
                    </button>
                )}
            </div>
        </div>
    )
}
