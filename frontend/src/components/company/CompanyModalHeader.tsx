import { Building2, Copy, Check, Share2, Star, ArrowLeftRight } from 'lucide-react'
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
  /** When true, adds right padding to avoid overlapping with a close button. Default: true */
  showCloseOverlap?: boolean
  headingId?: string
  descriptionId?: string
}

export function CompanyModalHeader({
  company,
  isLoading,
  copiedOrgnr,
  onCopyOrgnr,
  onShare,
  showCloseOverlap = true,
  headingId,
  descriptionId,
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
          className={`rounded-lg p-2.5 transition-colors md:p-2 ${isFavorite
            ? 'bg-yellow-50 text-yellow-500 hover:bg-yellow-100 dark:bg-yellow-500/15 dark:text-yellow-200 dark:hover:bg-yellow-500/20'
            : 'text-gray-600 hover:bg-gray-100 hover:text-yellow-600 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-yellow-300'
            }`}
          title={isFavorite ? 'Fjern fra favoritter' : 'Legg til favoritter'}
          aria-label={isFavorite ? 'Fjern fra favoritter' : 'Legg til favoritter'}
        >
          <Star className="h-5 w-5" fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      )}

      {/* Compare button */}
      {company && (
        <button
          onClick={handleCompare}
          disabled={!isSelected && !canAddMore}
          className={`rounded-lg p-2.5 transition-colors md:p-2 ${isSelected
            ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-200 dark:hover:bg-blue-500/20'
            : canAddMore
              ? 'text-gray-600 hover:bg-gray-100 hover:text-blue-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-blue-300'
              : 'cursor-not-allowed text-gray-400 dark:text-slate-700'
            }`}
          title={isSelected ? 'Fjern fra sammenligning' : canAddMore ? 'Legg til sammenligning' : 'Maks 3 virksomheter'}
          aria-label={isSelected ? 'Fjern fra sammenligning' : canAddMore ? 'Legg til sammenligning' : 'Maks 3 virksomheter'}
        >
          <ArrowLeftRight className="h-5 w-5" aria-hidden="true" />
        </button>
      )}

      <button
        onClick={onShare}
        className="rounded-lg p-2.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-300 md:p-2"
        title="Del virksomhetsprofil"
        aria-label="Del virksomhetsprofil"
      >
        <Share2 className="h-5 w-5" aria-hidden="true" />
      </button>

      {company && (
        <a
          href={getBrregEnhetsregisteretUrl(company.orgnr)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg p-2.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200 md:p-2"
          title="Se i Enhetsregisteret (Brreg)"
          aria-label="Se i Enhetsregisteret (Brreg)"
        >
          <svg className="h-5 w-5" viewBox="0 0 38 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
          className="rounded-lg p-2.5 text-gray-600 transition-colors hover:bg-gray-100 hover:text-[#0A66C2] dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-blue-300 md:p-2"
          title={`Søk etter ${company.navn} på LinkedIn`}
          aria-label={`Søk etter ${company.navn} på LinkedIn`}
        >
          <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M19 0h-14c-2.76 0-5 2.24-5 5v14c0 2.76 2.24 5 5 5h14c2.76 0 5-2.24 5-5v-14c0-2.76-2.24-5-5-5zM8 19H5V10h3v9zM6.5 8.25c-.97 0-1.75-.78-1.75-1.75s.78-1.75 1.75-1.75 1.75.78 1.75 1.75-.78 1.75-1.75 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93-.73 0-1.27.35-1.62 1.03V19h-3V10h2.76v1.23h.04c.38-.72 1.17-1.47 2.52-1.47 1.86 0 3.08 1.17 3.08 3.56V19z" />
          </svg>
        </a>
      )}
    </div>
  )

  return (
    <div className="relative min-h-32 border-b border-gray-200 p-4 dark:border-slate-800 md:p-6">
      <div className={`flex flex-col gap-4 md:flex-row md:justify-between md:items-start md:gap-0 ${showCloseOverlap ? 'pr-12 md:pr-10' : ''}`}>
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="space-y-2">
              <div className="h-8 w-full max-w-60 animate-pulse rounded bg-gray-200 dark:bg-slate-800" />
              <div className="h-4 w-full max-w-40 animate-pulse rounded bg-gray-200 dark:bg-slate-800" />
            </div>
          ) : company ? (
            <>
              <h1 id={headingId} className="wrap-break-word flex items-center gap-2 text-xl font-bold text-gray-900 dark:text-white md:text-2xl">
                <Building2 className="h-6 w-6 shrink-0 text-blue-600 dark:text-blue-300" aria-hidden="true" />
                <span>{company.navn}</span>
              </h1>
              <div id={descriptionId} className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
                  <span>Org.nr: {company.orgnr}</span>
                  <button
                    onClick={() => onCopyOrgnr(company.orgnr)}
                    className="rounded p-1 transition-colors hover:bg-gray-100 dark:hover:bg-white/10"
                    title="Kopier organisasjonsnummer"
                    aria-label="Kopier organisasjonsnummer"
                  >
                    {copiedOrgnr ? (
                      <Check className="h-4 w-4 text-green-600 dark:text-emerald-300" aria-hidden="true" />
                    ) : (
                      <Copy className="h-4 w-4 text-gray-500 dark:text-slate-400" aria-hidden="true" />
                    )}
                  </button>
                </div>
                <span className="hidden text-sm text-gray-400 dark:text-slate-600 sm:inline">•</span>
                <span
                  className="text-sm text-gray-600 dark:text-slate-300"
                  title={getOrganizationFormLabel(company.organisasjonsform)}
                >
                  {getOrganizationFormLabel(company.organisasjonsform)}
                </span>
              </div>
              {company.updated_at && (
                <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">
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
