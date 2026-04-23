import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import { getCompanyDetailQueryOptions } from '../hooks/queries/useCompanyDetailQuery'
import { queryClient } from '../lib/queryClient'
import { logger } from '../utils/logger'
import { useFetchCompanyMutation } from '../hooks/mutations/useFetchCompanyMutation'

// Validation
interface CompanySearchParams {
  orgnr: string
}

const companySearchSchema = z.object({
  tab: z.enum(['oversikt', 'okonomi', 'sammenligning', 'avdelinger', 'roller']).optional(),
})

const validateOrgnr = (orgnr: string): boolean => {
  return /^\d{9}$/.test(orgnr)
}

// Sub-component for COMPANY_NOT_FOUND — must be a named component to use hooks
// eslint-disable-next-line react-refresh/only-export-components
function CompanyNotFoundPage() {
  const { orgnr } = Route.useParams()
  const navigate = Route.useNavigate()
  const fetchMutation = useFetchCompanyMutation()

  const handleFetch = () => {
    fetchMutation.mutate(
      { orgnr, fetch_financials: true },
      {
        onSuccess: () =>
          navigate({ to: '/virksomhet/$orgnr', params: { orgnr } }),
      }
    )
  }

  return (
    <>
      <title>Selskap ikke funnet — Bedriftsgrafen</title>
      <meta name="robots" content="noindex" />
      <div className="text-center py-16">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4">
          Selskapet finnes ikke
        </h1>
        <p className="text-gray-600 mb-2">
          Virksomhet med organisasjonsnummer{' '}
          <span className="font-mono font-semibold">{orgnr}</span> finnes ikke i
          databasen.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          Du kan forsøke å hente virksomheten fra Brønnøysundregistrene.
        </p>
        <button
          onClick={handleFetch}
          disabled={fetchMutation.isPending}
          className="inline-block px-5 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 mr-4 mb-4"
        >
          {fetchMutation.isPending ? 'Henter...' : 'Hent fra Brønnøysund'}
        </button>
        <Link
          to="/"
          className="inline-block text-blue-600 hover:underline font-medium hover:text-blue-700"
        >
          ← Tilbake til forsiden
        </Link>
      </div>
    </>
  )
}

export const Route = createFileRoute('/virksomhet/$orgnr')({
  // Validate search params
  validateSearch: (search) => companySearchSchema.parse(search),

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
      // Re-throw 404 so errorComponent can render dedicated not-found UI
      const status = (error as { response?: { status?: number } })?.response?.status
      if (status === 404) {
        throw error
      }
      // Fail gracefully for other errors - component can handle loading/error states
      logger.error('Failed to preload company:', error)
    }

    return { orgnr }
  },

  // Error handling
  errorComponent: ({ error }) => {
    const isValidationError = error.message.includes('Ugyldig organisasjonsnummer')
    const errorCode = (error as { response?: { data?: { code?: string } } })?.response
      ?.data?.code

    if (errorCode === 'COMPANY_NOT_FOUND') {
      return <CompanyNotFoundPage />
    }

    return (
      <div className="text-center py-16">
        <h1 className="text-2xl md:text-3xl font-bold text-red-700 mb-4">
          {isValidationError
            ? 'Ugyldig organisasjonsnummer'
            : 'Feil ved lasting av virksomhet'}
        </h1>
        <p className="text-gray-600 mb-6">
          {isValidationError
            ? 'Organisasjonsnummeret må være 9 siffer.'
            : 'Virksomheten ble ikke funnet eller en nettverksfeil oppstod.'}
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


