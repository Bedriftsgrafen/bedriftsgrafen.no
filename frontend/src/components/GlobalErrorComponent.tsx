import { useRouter } from '@tanstack/react-router'
import { AlertCircle, RotateCcw, Home } from 'lucide-react'

export function GlobalErrorComponent({ error }: { error: Error }) {
    const router = useRouter()

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-4 text-center">
            <div className="bg-red-50 p-4 rounded-full mb-6">
                <AlertCircle className="h-12 w-12 text-red-600" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Oisann, noe gikk galt!
            </h1>

            <p className="text-gray-600 max-w-md mb-8">
                Vi har støtt på en uventet feil. Beklager ulempen.
            </p>

            {/* Developer details (only in dev) */}
            {import.meta.env.DEV && (
                <div className="bg-gray-100 p-4 rounded-lg text-left overflow-auto max-w-2xl w-full mb-8 font-mono text-sm border border-gray-200">
                    <p className="font-bold text-red-700 mb-2">{error.message}</p>
                    <pre className="text-gray-600 whitespace-pre-wrap">{error.stack}</pre>
                </div>
            )}

            <div className="flex gap-4">
                <button
                    onClick={() => {
                        router.invalidate()
                        window.location.reload()
                    }}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-sm"
                >
                    <RotateCcw className="h-4 w-4" />
                    Last siden på nytt
                </button>

                <a
                    href="/"
                    className="flex items-center gap-2 px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium shadow-sm"
                >
                    <Home className="h-4 w-4" />
                    Gå til forsiden
                </a>
            </div>
        </div>
    )
}
