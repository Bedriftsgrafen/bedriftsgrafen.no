import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { AlertCircle } from 'lucide-react'

export const Route = createFileRoute('/$')({
  component: NotFoundPage,
})

function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="text-center space-y-6">
        <AlertCircle className="h-24 w-24 text-gray-400 mx-auto" />
        
        <div className="space-y-2">
          <h1 className="text-5xl font-bold text-gray-900">404</h1>
          <p className="text-xl text-gray-600">
            Siden du leter etter finnes ikke
          </p>
        </div>
        
        <p className="text-gray-500 max-w-md">
          Siden du prøvde å åpne finnes ikke eller er blitt slettet.
          Vær så vennlig å sjekk adressen og prøv igjen.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            ← Tilbake til forsiden
          </Link>
          
          <Link
            to="/om"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Om oss
          </Link>
        </div>
      </div>
    </div>
  )
}
