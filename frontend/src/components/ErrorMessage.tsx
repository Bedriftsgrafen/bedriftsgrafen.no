import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
  message?: string
  onRetry?: () => void
  compact?: boolean
}

export function ErrorMessage({ 
  message = 'Kunne ikke laste data', 
  onRetry,
  compact = false 
}: Props) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-red-600 text-sm">
        <AlertCircle className="h-4 w-4" />
        <span>{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-2 text-blue-600 hover:text-blue-700 underline"
          >
            Prøv igjen
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-red-900 font-medium mb-1">Feil ved lasting</p>
          <p className="text-red-700 text-sm">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              <RefreshCw className="h-4 w-4" />
              Prøv på nytt
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
