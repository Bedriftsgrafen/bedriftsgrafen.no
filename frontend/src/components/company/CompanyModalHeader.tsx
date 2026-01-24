import { Building2, Copy, Check, Share2, Star, GitCompareArrows } from 'lucide-react'
import type { CompanyWithAccounting } from '../../types'
import { formatDate, getLinkedInSearchUrl, getBrregEnhetsregisteretUrl } from '../../utils/formatters'
import { getOrganizationFormLabel } from '../../utils/organizationForms'
import { useFavoritesStore } from '../../store/favoritesStore'
import { useComparisonStore } from '../../store/comparisonStore'

interface CompanyModalHeaderProps {
  company: CompanyWithAccounting | undefined
  isLoading: boolean
  copiedOrgnr: boolean
  onCopyOrgnr: (orgnr: string) => void
  onShare: () => void
}

export function CompanyModalHeader({
  company,
  isLoading,
  copiedOrgnr,
  onCopyOrgnr,
  onShare
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

  const actionButtons = (
    <div className="flex items-center gap-2 md:gap-1 overflow-x-auto no-scrollbar pb-1 md:pb-0">
      {/* Favorite button */}
      {company && (
        <button
          onClick={handleFavorite}
          className={`p-2.5 md:p-2 rounded-lg transition-colors ${isFavorite
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
          className={`p-2.5 md:p-2 rounded-lg transition-colors ${isSelected
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
        className="p-2.5 md:p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
        title="Del bedriftsprofil"
      >
        <Share2 className="h-5 w-5" />
      </button>

      {company && (
        <a
          href={getBrregEnhetsregisteretUrl(company.orgnr)}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2.5 md:p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-700"
          title="Se i Enhetsregisteret (Brreg)"
          aria-label="Se i Enhetsregisteret (Brreg)"
        >
          <svg className="h-5 w-5" viewBox="0 0 38 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <rect y="0" width="10.36" height="3.453" />
            <rect x="13.816" y="0" width="10.362" height="3.453" />
            <rect x="27.632" y="0" width="10.362" height="3.453" />
            <rect y="6.907" width="10.36" height="3.455" />
            <rect x="13.816" y="6.907" width="10.362" height="3.455" />
            <rect x="27.632" y="6.907" width="10.362" height="3.455" />
            <rect y="13.816" width="10.36" height="3.454" />
            <rect x="13.816" y="13.816" width="10.362" height="3.454" />
            <rect y="20.723" width="10.36" height="3.453" />
            <rect x="13.816" y="20.723" width="10.362" height="3.453" />
            <rect y="27.632" width="10.36" height="3.453" />
            <rect x="13.816" y="27.632" width="10.362" height="3.453" />
          </svg>
        </a>
      )}

      {company && (
        <a
          href={getLinkedInSearchUrl(company.navn, 'company')}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2.5 md:p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-[#0A66C2]"
          title={`Søk etter ${company.navn} på LinkedIn`}
          aria-label={`Søk etter ${company.navn} på LinkedIn`}
        >
          <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zM8 19H5V10h3v9zM6.5 8.25c-.97 0-1.75-.78-1.75-1.75s.78-1.75 1.75-1.75 1.75.78 1.75 1.75-.78 1.75-1.75 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93-.73 0-1.27.35-1.62 1.03V19h-3V10h2.76v1.23h.04c.38-.72 1.17-1.47 2.52-1.47 1.86 0 3.08 1.17 3.08 3.56V19z" />
          </svg>
        </a>
      )}
    </div>
  )

  return (
    <div className="p-4 md:p-6 border-b border-gray-200 min-h-[128px]">
      <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-start md:gap-0">
        <div className="flex-1 min-w-0 pr-12 md:pr-0">
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-8 bg-gray-200 rounded w-full max-w-[240px] animate-pulse" />
              <div className="h-4 bg-gray-200 rounded w-full max-w-[160px] animate-pulse" />
            </div>
          ) : company ? (
            <>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2 break-words">
                <Building2 className="h-6 w-6 text-blue-600 flex-shrink-0" />
                <span>{company.navn}</span>
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
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
                <span className="text-sm text-gray-400 hidden sm:inline">•</span>
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

        <div className="flex items-center">
          {actionButtons}
        </div>
      </div>
    </div>
  )
}
