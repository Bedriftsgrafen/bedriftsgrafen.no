import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'
import { getCompanyDetailQueryOptions } from '../hooks/queries/useCompanyDetailQuery'
import { queryClient } from '../lib/queryClient'

// Validation
interface CompanySearchParams {
  orgnr: string
}

const validateOrgnr = (orgnr: string): boolean => {
  return /^\d{9}$/.test(orgnr)
}
export const Route = createFileRoute('/bedrift/$orgnr')({
  // Validate params
  params: {
    parse: (params): CompanySearchParams => {
      const orgnr = params.orgnr
      if (!validateOrgnr(orgnr)) {
        throw new Error('Ugyldig organisasjonsnummer. Må være 9 siffer.')
      }
      return { orgnr }
    },
    stringify: (params) => ({
      orgnr: params.orgnr,
    }),
  },

  // Pre-load data before rendering
  loader: async ({ params }) => {
    const { orgnr } = params

    try {
      // Pre-fetch company data with retry logic
      await queryClient.ensureQueryData(
        getCompanyDetailQueryOptions(orgnr)
      )
    } catch (error) {
      // Fail gracefully - component can handle loading/error states
      console.error('Failed to preload company:', error)
    }

    return { orgnr }
  },

  // Error handling
  errorComponent: ({ error }) => {
    const isValidationError = error.message.includes('Ugyldig organisasjonsnummer')

    return (
      <div className="text-center py-16">
        <h1 className="text-3xl font-bold text-red-600 mb-4">
          {isValidationError
            ? 'Ugyldig organisasjonsnummer'
            : 'Feil ved lasting av bedrift'}
        </h1>
        <p className="text-gray-600 mb-6">
          {isValidationError
            ? 'Organisasjonsnummeret må være 9 siffer.'
            : 'Bedriften ble ikke funnet eller en nettverksfeil oppstod.'}
        </p>
        <Link
          to="/"
          className="inline-block text-blue-600 hover:underline font-medium hover:text-blue-700"
        >
          ← Tilbake til forsiden
        </Link>
      </div>
    )
  },
})


