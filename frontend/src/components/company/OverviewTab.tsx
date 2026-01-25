import { Building2, Building, MapPin, Users, Calendar, Briefcase, ChevronRight, AlertTriangle, ExternalLink } from 'lucide-react'
import { useMemo } from 'react'
import type { CompanyWithAccounting, Naeringskode } from '../../types'
import { Link } from '@tanstack/react-router'
import { formatDate, getBrregEnhetsregisteretUrl } from '../../utils/formatters'
import { getOrganizationFormLabel } from '../../utils/organizationForms'
import { formatNace, getNaceCode } from '../../utils/nace'
import { LocationMap } from '../common/LocationMap'
import { ContactCard } from './ContactCard'
import { AffiliateBanner } from '../ads/AffiliateBanner'
import { AFFILIATIONS } from '../../constants/affiliations'

interface OverviewTabProps {
  company: CompanyWithAccounting
  onOpenIndustry?: (naceCode: string, description: string) => void
}

export function OverviewTab({ company, onOpenIndustry }: OverviewTabProps) {

  const showAffiliateBanner = useMemo(() => {
    if (!company.stiftelsesdato) return false
    const cutoffDate = new Date()
    cutoffDate.setFullYear(cutoffDate.getFullYear() - 2)
    return new Date(company.stiftelsesdato) > cutoffDate
  }, [company.stiftelsesdato])

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
                Bedriftsinformasjon
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
                <div>
                  <div className="text-sm font-medium text-gray-900">Organisasjonsform</div>
                  <div className="text-sm text-gray-600">
                    {getOrganizationFormLabel(company.organisasjonsform)}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Briefcase className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">Næringskode(r)</div>
                  <div className="text-sm">
                    {company.naeringskoder && company.naeringskoder.length > 0 ? (
                      <div className="space-y-1 mt-1">
                        {company.naeringskoder.map((nk: Naeringskode, i: number) => (
                          <button
                            key={i}
                            onClick={() => onOpenIndustry?.(nk.kode, nk.beskrivelse)}
                            className="w-full text-left group flex items-center justify-between py-1.5 px-2 -mx-2 rounded-lg border border-transparent hover:border-blue-200 hover:bg-blue-50 transition-all"
                            title={`Se andre bedrifter med næringskode ${nk.kode}`}
                          >
                            <span className="text-blue-600 group-hover:text-blue-700 group-hover:underline">
                              <span className="font-medium">{nk.kode}</span> {nk.beskrivelse}
                            </span>
                            <ChevronRight className="h-4 w-4 text-blue-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    ) : company.naeringskode ? (
                    <button
                        onClick={() => onOpenIndustry?.(getNaceCode(company.naeringskode)!, getNaceCode(company.naeringskode)!)}
                        className="flex items-center gap-2 group"
                    >
                        <Building className="h-4 w-4 text-blue-500" />
                        <span className="text-gray-600 group-hover:text-blue-600">{formatNace(company.naeringskode)}</span>
                    </button>
                    ) : (
                      <span className="text-gray-600">Ikke registrert</span>
                    )}
                  </div>
                </div>
              </div>

              {company.vedtektsfestet_formaal && (
                <div className="flex items-start gap-3">
                  <Briefcase className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">Vedtektsfestet formål</div>
                    <div className="text-sm text-gray-600 whitespace-pre-wrap">
                      {company.vedtektsfestet_formaal}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <div className="text-sm font-medium text-gray-900">Antall ansatte</div>
                  <div className="text-sm text-gray-600">
                    {company.antall_ansatte ?? 'Ikke registrert'}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-gray-900">Viktige datoer</div>
                  <div className="mt-1 space-y-2">
                    <div className="flex justify-between items-center text-sm border-b border-gray-50 pb-1">
                      <span className="text-gray-500">Stiftelsesdato</span>
                      <span className="font-medium text-gray-900">
                        {company.stiftelsesdato ? formatDate(company.stiftelsesdato) : 'Ikke registrert'}
                      </span>
                    </div>
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
                  </div>
                </div>
              </div>

              {/* Register Badges */}
              <div className="pt-2">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Andre registreringer</div>
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${company.registrert_i_foretaksregisteret ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    Foretaksregisteret
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${company.registrert_i_mvaregisteret ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                    MVA-registeret
                  </span>
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
            {(company.forretningsadresse || company.postadresse) && (
              <div className="mt-4">
                <LocationMap
                  companyName={company.navn ?? ''}
                  address={(() => {
                    const addr = company.forretningsadresse || company.postadresse!
                    return [
                      ...addr.adresse,
                      `${addr.postnummer} ${addr.poststed}`,
                      addr.land
                    ].join(', ')
                  })()}
                  postalCode={(company.forretningsadresse || company.postadresse)?.postnummer}
                  latitude={company.latitude}
                  longitude={company.longitude}
                  geocodedAt={company.geocoded_at}
                />
              </div>
            )}

            {/* Contact Card - below map */}
            <div className="mt-6">
              <ContactCard
                telefon={company.telefon}
                mobil={company.mobil}
                epostadresse={company.epostadresse}
                hjemmeside={company.hjemmeside}
              />
            </div>
          </div>
        </div>
      </div>

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
