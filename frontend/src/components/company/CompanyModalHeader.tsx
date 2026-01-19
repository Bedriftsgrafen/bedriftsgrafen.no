import { Building2, Copy, Check, Share2, X, Star, GitCompareArrows } from 'lucide-react'
import type { CompanyWithAccounting } from '../../types'
import { formatDate } from '../../utils/formatters'
import { getOrganizationFormLabel } from '../../utils/organizationForms'
import { ErrorMessage } from '../ErrorMessage'
import { useFavoritesStore } from '../../store/favoritesStore'
import { useComparisonStore } from '../../store/comparisonStore'

interface CompanyModalHeaderProps {
  company: CompanyWithAccounting | undefined
  isLoading: boolean
  isError: boolean
  copiedOrgnr: boolean
  onCopyOrgnr: (orgnr: string) => void
  onShare: () => void
  onClose: () => void
  onRetry: () => void
}

export function CompanyModalHeader({
  company,
  isLoading,
  isError,
  copiedOrgnr,
  onCopyOrgnr,
  onShare,
  onClose,
  onRetry
}: CompanyModalHeaderProps) {
  // Favorites
  const isFavorite = useFavoritesStore((s) => company ? s.isFavorite(company.orgnr) : false)
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite)

  // Comparison
  const isSelected = useComparisonStore((s) => company ? s.isSelected(company.orgnr) : false)
  const addCompany = useComparisonStore((s) => s.addCompany)
  const removeCompany = useComparisonStore((s) => s.removeCompany)
  const companies = useComparisonStore((s) => s.companies)
  const canAddMore = companies.length < 3

  const handleFavorite = () => {
    if (company) {
      toggleFavorite({
        orgnr: company.orgnr,
        navn: company.navn ?? 'Ukjent navn',
        organisasjonsform: company.organisasjonsform
      })
    }
  }

  const handleCompare = () => {
    if (company) {
      if (isSelected) {
        removeCompany(company.orgnr)
      } else {
        addCompany({
          orgnr: company.orgnr,
          navn: company.navn ?? 'Ukjent navn'
        })
      }
    }
  }

  return (
    <div className="p-6 border-b border-gray-200 flex justify-between items-start">
      <div className="flex-1">
        {isLoading ? (
          <div className="space-y-2">
            <h1 className="h-8 bg-gray-200 rounded w-64 animate-pulse" />
            <div className="h-4 bg-gray-200 rounded w-48 animate-pulse" />
          </div>
        ) : isError ? (
          <ErrorMessage
            message="Kunne ikke laste bedrift"
            onRetry={onRetry}
            compact
          />
        ) : company ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="h-6 w-6 text-blue-600" />
              {company.navn}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <div className="text-sm text-gray-600 flex items-center gap-2">
                <span>Org.nr: {company.orgnr}</span>
                <button
                  onClick={() => onCopyOrgnr(company.orgnr)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title="Kopier organisasjonsnummer"
                >
                  {copiedOrgnr ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-gray-500" />
                  )}
                </button>
              </div>
              <span className="text-sm text-gray-400">•</span>
              <span
                className="text-sm text-gray-600"
                title={getOrganizationFormLabel(company.organisasjonsform)}
              >
                {getOrganizationFormLabel(company.organisasjonsform)}
              </span>
            </div>
            {company.updated_at && (
              <div className="text-xs text-gray-500 mt-2">
                Sist oppdatert: {formatDate(company.updated_at)}
              </div>
            )}
          </>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        {/* Favorite button */}
        {company && (
          <button
            onClick={handleFavorite}
            className={`p-2 rounded-lg transition-colors ${isFavorite
              ? 'bg-yellow-50 text-yellow-500 hover:bg-yellow-100'
              : 'text-gray-400 hover:bg-gray-100 hover:text-yellow-500'
              }`}
            title={isFavorite ? 'Fjern fra favoritter' : 'Legg til favoritter'}
          >
            <Star className="h-5 w-5" fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        )}

        {/* Compare button */}
        {company && (
          <button
            onClick={handleCompare}
            disabled={!isSelected && !canAddMore}
            className={`p-2 rounded-lg transition-colors ${isSelected
              ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              : canAddMore
                ? 'text-gray-400 hover:bg-gray-100 hover:text-blue-500'
                : 'text-gray-300 cursor-not-allowed'
              }`}
            title={isSelected ? 'Fjern fra sammenligning' : canAddMore ? 'Legg til sammenligning' : 'Maks 3 bedrifter'}
          >
            <GitCompareArrows className="h-5 w-5" />
          </button>
        )}

        <button
          onClick={onShare}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
          title="Del bedriftsprofil"
        >
          <Share2 className="h-5 w-5" />
        </button>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <X className="h-6 w-6 text-gray-500" />
        </button>
      </div>
    </div>
  )
}
