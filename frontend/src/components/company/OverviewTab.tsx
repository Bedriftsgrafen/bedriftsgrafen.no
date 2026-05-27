import { Activity, Building2, Building, MapPin, Users, Calendar, Briefcase, ChevronRight, AlertTriangle, ExternalLink, Home, Coins, Database } from 'lucide-react'
import { useMemo, lazy, Suspense } from 'react'
import type { CompanyWithAccounting, Naeringskode } from '../../types'
import { Link } from '@tanstack/react-router'
import { formatDate, getBrregEnhetsregisteretUrl, normalizeText, formatLargeCurrency } from '../../utils/formatters'
import { getOrganizationFormLabel } from '../../utils/organizationForms'
import { formatNace, getNaceCode } from '../../utils/nace'
import { buildCompanyFreshnessItems, buildCompanyTimelineEvents, type CompanyTimelineTone } from '../../utils/companyTimeline'
import { ContactCard } from './ContactCard'
import { AffiliateBanner } from '../ads/AffiliateBanner'
import { AFFILIATIONS } from '../../constants/affiliations'

// Lazy-load LocationMap to avoid pulling leaflet (~154KB) into the main CompanyModal bundle
const LocationMap = lazy(() => import('../common/LocationMap').then(m => ({ default: m.LocationMap })))

interface OverviewTabProps {
  company: CompanyWithAccounting
  onOpenIndustry?: (naceCode: string, description: string) => void
}

const timelineToneClassNames: Record<CompanyTimelineTone, string> = {
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700',
  positive: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800',
  critical: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800',
  info: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-800',
}

export function OverviewTab({ company, onOpenIndustry }: OverviewTabProps) {

  const timelineEvents = useMemo(() => buildCompanyTimelineEvents(company), [company])
  const freshnessItems = useMemo(() => buildCompanyFreshnessItems(company), [company])

  const showAffiliateBanner = useMemo(() => {
    if (!company.stiftelsesdato) return false
    const cutoffDate = new Date()
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 2)
    return new Date(company.stiftelsesdato) > cutoffDate
  }, [company.stiftelsesdato])

  const mapAddr = company.forretningsadresse || company.postadresse
  const mapAddress = mapAddr
    ? [...mapAddr.adresse, `${mapAddr.postnummer} ${mapAddr.poststed}`, mapAddr.land].join(', ')
    : undefined

  return (
    <div className="space-y-6">

      {/* Bankruptcy/Dissolution Status Banner */}
      {(company.konkurs || company.under_avvikling || company.under_tvangsavvikling) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600 shrink-0" />
            <div>
              <div className="font-semibold text-red-800">
                {company.konkurs ? 'Konkurs' :
                  company.under_tvangsavvikling ? 'Under tvangsavvikling' :
                    'Under avvikling'}
              </div>
              {company.konkursdato && (
                <div className="text-sm text-red-600">
                  Dato: {formatDate(company.konkursdato)}
                </div>
              )}
              <a
                href={getBrregEnhetsregisteretUrl(company.orgnr)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-red-700 hover:text-red-900 underline mt-1 inline-flex items-center gap-1"
              >
                Se i Enhetsregisteret
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          {/* Key Info */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                Virksomhetsinformasjon
              </h3>
              <a
                href={getBrregEnhetsregisteretUrl(company.orgnr)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                title="Åpne i Enhetsregisteret (Brreg)"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 38 32" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
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
                Brreg
              </a>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">Organisasjonsform</div>
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    {getOrganizationFormLabel(company.organisasjonsform)}
                    {company.er_i_konsern && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-tighter shadow-xs" title="Virksomheten inngår i et konsern">
                        Konsern
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {company.parent_orgnr && (
                <div className="flex items-start gap-3">
                  <Home className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Hovedenhet</div>
                    <Link
                      to="/virksomhet/$orgnr"
                      params={{ orgnr: company.parent_orgnr }}
                      replace
                      className="mt-1 block p-3 rounded-lg border border-blue-100 bg-blue-50/30 hover:bg-blue-50 hover:border-blue-300 transition-all group"
                    >
                      <div className="text-sm text-blue-600 font-bold group-hover:text-blue-800 flex items-center justify-between">
                        <span className="max-w-55 truncate" title={company.parent_navn}>
                          {company.parent_navn || 'Gå til hovedenhet'}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                      </div>
                      <div className="text-xs text-gray-500 font-normal mt-0.5">
                        Org.nr {company.parent_orgnr}
                      </div>
                    </Link>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Briefcase className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">Næringskode(r)</div>
                  <div className="text-sm">
                    {company.naeringskoder && company.naeringskoder.length > 0 ? (
                      <div className="space-y-1 mt-1">
                        {company.naeringskoder.map((nk: Naeringskode, i: number) => (
                          <button
                            key={i}
                            onClick={() => onOpenIndustry?.(nk.kode, nk.beskrivelse)}
                            className="w-full text-left group flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg border border-transparent hover:border-blue-200 hover:bg-blue-50 transition-all min-w-0"
                            title={`Se andre virksomheter med næringskode ${nk.kode}`}
                          >
                            <span className="text-blue-600 group-hover:text-blue-700 group-hover:underline flex-1">
                              <span className="font-medium">{nk.kode}</span> {nk.beskrivelse}
                            </span>
                            <ChevronRight className="h-4 w-4 text-blue-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                          </button>
                        ))}
                      </div>
                    ) : company.naeringskode ? (
                      <div className="space-y-1 mt-1">
                        <button
                          onClick={() => {
                            const code = getNaceCode(company.naeringskode)!
                            onOpenIndustry?.(code, formatNace(company.naeringskode).replace(code, '').replace(/^ - /, ''))
                          }}
                          className="w-full text-left group flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg border border-transparent hover:border-blue-200 hover:bg-blue-50 transition-all min-w-0"
                          title={`Se andre virksomheter med næringskode ${getNaceCode(company.naeringskode)}`}
                        >
                          <span className="text-blue-600 group-hover:text-blue-700 group-hover:underline flex-1">
                            <span className="font-medium">{getNaceCode(company.naeringskode)}</span> {formatNace(company.naeringskode).replace(getNaceCode(company.naeringskode) || '', '').replace(/^ - /, '')}
                          </span>
                          <ChevronRight className="h-4 w-4 text-blue-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-600">Ikke registrert</span>
                    )}
                  </div>
                </div>
              </div>

              {company.vedtektsfestet_formaal && (
                <div className="flex items-start gap-3">
                  <Briefcase className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">Vedtektsfestet formål</div>
                    <div className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                      {normalizeText(company.vedtektsfestet_formaal)}
                    </div>
                  </div>
                </div>
              )}

              {company.institusjonell_sektor && (
                <div className="flex items-start gap-3">
                  <Building className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">Institusjonell sektor</div>
                    <div className="text-sm text-gray-600 truncate" title={company.institusjonell_sektor}>
                      {company.institusjonell_sektor}
                    </div>
                  </div>
                </div>
              )}

              {company.antall_ansatte !== null && company.antall_ansatte !== undefined && (
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">Antall ansatte</div>
                    <div className="text-sm text-gray-600">
                      {company.antall_ansatte} {company.antall_ansatte === 1 ? 'ansatt' : 'ansatte'}
                    </div>
                  </div>
                </div>
              )}

              {company.aksjekapital !== undefined && company.aksjekapital !== null && company.aksjekapital > 0 && (
                <div className="flex items-start gap-3">
                  <Coins className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">Aksjekapital</div>
                    <div className="text-sm text-gray-600">
                      {formatLargeCurrency(company.aksjekapital)}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">Viktige datoer</div>
                  <div className="mt-1 space-y-2">
                    {company.stiftelsesdato && (
                      <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-1">
                        <span className="text-gray-500">Stiftelsesdato</span>
                        <span className="font-medium text-gray-900">
                          {formatDate(company.stiftelsesdato)}
                        </span>
                      </div>
                    )}
                    {company.registreringsdato_enhetsregisteret && (
                      <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-1">
                        <span className="text-gray-500">Reg. Enhetsregisteret</span>
                        <span className="font-medium text-gray-900">
                          {formatDate(company.registreringsdato_enhetsregisteret)}
                        </span>
                      </div>
                    )}
                    {company.registreringsdato_foretaksregisteret && (
                      <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-1">
                        <span className="text-gray-500">Reg. Foretaksregisteret</span>
                        <span className="font-medium text-gray-900">
                          {formatDate(company.registreringsdato_foretaksregisteret)}
                        </span>
                      </div>
                    )}
                    {!company.stiftelsesdato && !company.registreringsdato_enhetsregisteret && (
                      <div className="text-sm text-gray-400 italic">Ingen registrerte datoer</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Register Badges */}
              {(company.registrert_i_foretaksregisteret ||
                company.registrert_i_mvaregisteret ||
                company.registrert_i_frivillighetsregisteret ||
                company.registrert_i_stiftelsesregisteret ||
                company.registrert_i_partiregisteret) && (
                  <div className="pt-2">
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Andre registreringer</div>
                    <div className="flex flex-wrap gap-2">
                      {company.registrert_i_foretaksregisteret && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          Foretaksregisteret
                        </span>
                      )}
                      {company.registrert_i_mvaregisteret && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          MVA-registeret
                        </span>
                      )}
                      {company.registrert_i_frivillighetsregisteret && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          Frivillighetsregisteret
                        </span>
                      )}
                      {company.registrert_i_stiftelsesregisteret && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          Stiftelsesregisteret
                        </span>
                      )}
                      {company.registrert_i_partiregisteret && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                          Partiregisteret
                        </span>
                      )}
                    </div>
                  </div>
                )}

            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Addresses */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Adresser
            </h3>
            <div className="space-y-6">
              {company.forretningsadresse && (
                <div>
                  <div className="text-sm font-medium text-gray-900 mb-1">Forretningsadresse</div>
                  <div className="text-sm text-gray-600">
                    {company.forretningsadresse.adresse.map((line: string, i: number) => (
                      <div key={i}>{line}</div>
                    ))}
                    <div>
                      {company.forretningsadresse.postnummer} {company.forretningsadresse.poststed}
                    </div>
                    <div>{company.forretningsadresse.land}</div>
                    {company.forretningsadresse.kommunenummer && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <Link
                          to="/kommune/$code"
                          params={{ code: `${company.forretningsadresse.kommunenummer}-${(company.forretningsadresse.kommune || 'kommune').toLowerCase().replace(' ', '-')}` }}
                          className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline group"
                        >
                          <Users className="h-4 w-4" />
                          Se {company.forretningsadresse.kommune} Dashboard
                          <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {company.postadresse && (
                <div>
                  <div className="text-sm font-medium text-gray-900 mb-1">Postadresse</div>
                  <div className="text-sm text-gray-600">
                    {company.postadresse.adresse.map((line: string, i: number) => (
                      <div key={i}>{line}</div>
                    ))}
                    <div>
                      {company.postadresse.postnummer} {company.postadresse.poststed}
                    </div>
                    <div>{company.postadresse.land}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Map */}
            {mapAddr && (
              <div className="mt-4">
                <Suspense fallback={<div className="h-48 bg-gray-100 rounded-lg animate-pulse" />}>
                <LocationMap
                  companyName={company.navn ?? ''}
                  address={mapAddress!}
                  postalCode={mapAddr.postnummer}
                  latitude={company.latitude}
                  longitude={company.longitude}
                  geocodedAt={company.geocoded_at}
                />
                </Suspense>
              </div>
            )}

            {/* Contact Card - below map */}
            <div className="mt-6">
              <ContactCard
                companyName={company.navn ?? undefined}
                telefon={company.telefon}
                mobil={company.mobil}
                epostadresse={company.epostadresse}
                hjemmeside={company.hjemmeside}
              />
            </div>
          </div>
        </div>
      </div>

      <section
        className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800"
        aria-labelledby="company-timeline-heading"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 id="company-timeline-heading" className="text-lg font-semibold text-gray-900 flex items-center gap-2 dark:text-slate-50">
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Hendelser og datagrunnlag
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
              Daterte hendelser og kildeinformasjon basert på data som allerede finnes hos Bedriftsgrafen.
            </p>
          </div>
          <a
            href={getBrregEnhetsregisteretUrl(company.orgnr)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline dark:text-blue-300 dark:hover:text-blue-200"
          >
            Kontroller hos Brreg
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(260px,0.75fr)]">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Viktige hendelser</h4>
            {timelineEvents.length > 0 ? (
              <ol className="mt-4 space-y-4" aria-label="Tidslinje for virksomheten">
                {timelineEvents.map((event) => (
                  <li key={event.id} className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3">
                    <div className="flex flex-col items-center" aria-hidden="true">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-full ring-1 ${timelineToneClassNames[event.tone]}`}>
                        <Calendar className="h-4 w-4" />
                      </span>
                      <span className="mt-2 h-full w-px bg-gray-200 dark:bg-slate-700" />
                    </div>
                    <div className="min-w-0 pb-2">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                        <p className="font-medium text-gray-900 dark:text-slate-50">{event.title}</p>
                        <time className="text-sm font-medium text-gray-600 dark:text-slate-300" dateTime={event.date}>
                          {formatDate(event.date)}
                        </time>
                      </div>
                      <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{event.description}</p>
                      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-slate-500">{event.source}</p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:bg-slate-800 dark:text-slate-300">
                Ingen daterte hendelser er tilgjengelige for denne virksomheten ennå.
              </p>
            )}
          </div>

          <div className="lg:border-l lg:border-gray-200 lg:pl-6 dark:lg:border-slate-800">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 dark:text-slate-100">
              <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Datagrunnlag
            </h4>
            <dl className="mt-4 divide-y divide-gray-100 dark:divide-slate-800">
              {freshnessItems.map((item) => (
                <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <dt className="text-sm font-medium text-gray-900 dark:text-slate-100">{item.label}</dt>
                  <dd className="mt-1">
                    <span className={`inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${timelineToneClassNames[item.tone]}`}>
                      {item.valueType === 'date' ? formatDate(item.value) : item.value}
                    </span>
                    <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">{item.description}</p>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-slate-500">{item.source}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Affiliate Banner - shown for newer companies */}
      {showAffiliateBanner && (
        <AffiliateBanner
          bannerId={`overview_${AFFILIATIONS.TJENESTETORGET_ACCOUNTANT.id}`}
          placement="overview_tab"
          {...AFFILIATIONS.TJENESTETORGET_ACCOUNTANT}
        />
      )}
    </div>
  )
}
