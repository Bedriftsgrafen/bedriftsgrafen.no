import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
    message?: string
    className?: string
}

export function LoadingState({ message = 'Laster...', className = '' }: LoadingStateProps) {
    return (
        <div className={`p-8 text-center bg-white rounded-xl border border-gray-200 ${className}`}>
            <div className="flex flex-col items-center justify-center gap-3 text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <span className="text-sm font-medium">{message}</span>
            </div>
        </div>
    )
}
