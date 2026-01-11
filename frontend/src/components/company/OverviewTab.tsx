import { Building2, MapPin, Users, Calendar, Globe, Briefcase, ChevronRight, AlertTriangle, ExternalLink, Calculator } from 'lucide-react'
import { useMemo } from 'react'
import type { CompanyWithAccounting, Naeringskode } from '../../types'
import { formatDate } from '../../utils/formatters'
import { getOrganizationFormLabel } from '../../utils/organizationForms'
import { LocationMap } from '../common/LocationMap'
import { AffiliateBanner } from '../ads/AffiliateBanner'
import { useABTest } from '../../utils/abTesting'
import { CONTACT_EMAIL } from '../../constants/contact'

interface OverviewTabProps {
  company: CompanyWithAccounting
  onOpenIndustry?: (naceCode: string, description: string) => void
}

export function OverviewTab({ company, onOpenIndustry }: OverviewTabProps) {
  const abTestVariant = useABTest('overview_banner_copy', ['A', 'B'])

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
                href={`https://data.brreg.no/enhetsregisteret/oppslag/enheter/${company.orgnr}`}
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Bedriftsinformasjon
            </h3>
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
                        onClick={() => onOpenIndustry?.(company.naeringskode!, company.naeringskode!)}
                        className="group flex items-center gap-1 py-1 px-2 -mx-2 rounded hover:bg-blue-50 transition-colors"
                        title={`Se andre bedrifter med næringskode ${company.naeringskode}`}
                      >
                        <span className="text-gray-600 group-hover:text-blue-600">{company.naeringskode}</span>
                        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
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
                <div>
                  <div className="text-sm font-medium text-gray-900">Stiftelsesdato</div>
                  <div className="text-sm text-gray-600">
                    {company.stiftelsesdato ? formatDate(company.stiftelsesdato) : 'Ikke registrert'}
                  </div>
                </div>
              </div>

              {company.hjemmeside && (
                <div className="flex items-start gap-3">
                  <Globe className="h-5 w-5 text-gray-400 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-gray-900">Nettside</div>
                    <a
                      href={company.hjemmeside.startsWith('http') ? company.hjemmeside : `https://${company.hjemmeside}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {company.hjemmeside}
                    </a>
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
          </div>
        </div>
      </div>

      {/* Affiliate Banner - shown for newer companies */}
      {showAffiliateBanner && (
        <AffiliateBanner
          bannerId={`accounting_overview_${abTestVariant}`}
          placement="overview_tab"
          title={abTestVariant === 'A' ? "Tilbyr dere regnskapstjenester?" : "Vil du hjelpe gründere?"}
          description={abTestVariant === 'A'
            ? `Nå ut til nye bedrifter i etableringsfasen. Bli vår samarbeidspartner. Kontakt ${CONTACT_EMAIL}.`
            : `Denne annonseplassen er reservert for regnskapsførere. Kontakt oss på ${CONTACT_EMAIL} for avtale.`}
          buttonText="Send e-post"
          link={`mailto:${CONTACT_EMAIL}`}
          icon={Calculator}
          variant="accounting"
          isPlaceholder
        />
      )}
    </div>
  )
}
