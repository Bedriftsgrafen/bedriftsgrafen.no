import { Link } from '@tanstack/react-router'
import { Building2, MapPin } from 'lucide-react'
import { useSimilarCompaniesQuery } from '../../hooks/queries/useSimilarCompaniesQuery'

interface SimilarCompaniesProps {
  orgnr: string | null
}

// Pre-allocated array for skeleton to avoid recreation on each render
const SKELETON_ITEMS = [0, 1, 2, 3, 4, 5]

function SimilarCompaniesSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {SKELETON_ITEMS.map((i) => (
        <div key={i} className="animate-pulse p-3 bg-gray-50 rounded-lg border border-gray-200">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2 mb-1"></div>
          <div className="h-3 bg-gray-200 rounded w-1/3"></div>
        </div>
      ))}
    </div>
  )
}

import { formatLargeCurrency } from '../../utils/formatters'
import { formatNace } from '../../utils/nace'

export function SimilarCompanies({ orgnr }: SimilarCompaniesProps) {
  const { data: companies, isLoading } = useSimilarCompaniesQuery(orgnr)

  // Don't render anything if no orgnr
  if (!orgnr) return null

  // Show skeleton while loading
  if (isLoading) {
    return (
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-blue-600" />
          Lignende bedrifter i nærheten
        </h3>
        <SimilarCompaniesSkeleton />
      </div>
    )
  }

  // Don't show section if no similar companies found
  if (!companies || companies.length === 0) return null

  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
        <Building2 className="h-4 w-4 text-blue-600" />
        Lignende bedrifter i nærheten
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {companies.map((company) => {
          const kommune = company.forretningsadresse?.kommune || company.postadresse?.kommune
          const hasRevenue = company.latest_revenue != null && company.latest_revenue > 0

          return (
            <Link
              key={company.orgnr}
              to="/bedrift/$orgnr"
              params={{ orgnr: company.orgnr }}
              className="text-left p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors group min-w-0"
            >
              <p className="font-medium text-gray-900 text-sm truncate group-hover:text-blue-700">
                {company.navn}
              </p>
              <div className="text-[10px] text-gray-500 mt-1 truncate" title={formatNace(company.naeringskode)}>
                {hasRevenue ? (
                  formatLargeCurrency(company.latest_revenue)
                ) : (
                  formatNace(company.naeringskode) || 'Ukjent bransje'
                )}
              </div>

              {kommune && (
                <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {kommune}
                </p>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
