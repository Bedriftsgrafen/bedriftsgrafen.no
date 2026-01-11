import { Link } from '@tanstack/react-router'
import { History, Building2 } from 'lucide-react'
import { useUiStore } from '../store/uiStore'
import { formatDistanceToNow } from '../utils/formatters'
import { getOrganizationFormLabel } from '../utils/organizationForms'

export function RecentCompanies() {
  const { recentCompanies, clearRecentCompanies } = useUiStore()

  if (recentCompanies.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 mb-8">
      <div className="p-4 border-b border-blue-100 bg-blue-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-blue-600" />
          <h2 className="font-semibold text-gray-900">Nylig besøkte bedrifter</h2>
        </div>
        <button
          onClick={clearRecentCompanies}
          className="text-sm px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-red-200 rounded-lg transition-colors font-medium"
        >
          Tøm historikk
        </button>
      </div>
      <div className="p-4 flex flex-wrap gap-2">
        {recentCompanies.map((company) => (
          <Link
            key={company.orgnr}
            to="/bedrift/$orgnr"
            params={{ orgnr: company.orgnr }}
            className="group flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-700 border border-gray-200 hover:border-blue-300 rounded-full transition-colors text-sm"
            title={`${company.navn} • ${company.orgnr} • Besøkt ${formatDistanceToNow(company.timestamp)}`}
          >
            <Building2 className="h-3.5 w-3.5 text-gray-400 group-hover:text-blue-500" />
            <span className="max-w-[200px] truncate font-medium">{company.navn}</span>
            <span className="text-gray-400 group-hover:text-blue-500">•</span>
            <span 
              className="text-gray-500 group-hover:text-blue-600"
              title={getOrganizationFormLabel(company.organisasjonsform)}
            >
              {company.organisasjonsform}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
