/* eslint-disable react-refresh/only-export-components */
import { createLazyFileRoute, Link } from '@tanstack/react-router'
import { User, Building2, ExternalLink, ShieldCheck, Briefcase, AlertTriangle } from 'lucide-react'
import { SEOHead, Breadcrumbs } from '../components/layout'
import { usePersonRolesQuery } from '../hooks/queries/usePersonRolesQuery'
import { useSlowLoadingToast } from '../hooks/useSlowLoadingToast'
import { Button } from '../components/common/Button'
import logo1881 from '../img/1881-logo.png'
import { get1881SearchUrl, getLinkedInSearchUrl } from '../utils/formatters'

const LinkedinIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
)

export const Route = createLazyFileRoute('/person/$name/$birthdate')({
    component: PersonProfilePage,
})

export function PersonProfilePage() {
    const { name, birthdate } = Route.useParams()
    const decodedName = decodeURIComponent(name)
    const normalizedBirthdate = birthdate === 'unknown' ? null : birthdate
    const isYearOnly = normalizedBirthdate ? /^\d{4}$/.test(normalizedBirthdate) : false

    const {
        data: roles,
        isLoading,
        isError,
    } = usePersonRolesQuery(decodedName, normalizedBirthdate)

    useSlowLoadingToast(isLoading, 'Henter rolleoversikt...')

    const hasNoRoles = !isLoading && !isError && roles?.length === 0

    return (
        <>
            <SEOHead
                title={`${decodedName} - Roller og verv | Bedriftsgrafen`}
                description={`Oversikt over roller og verv for ${decodedName} i norsk næringsvirksomhet.`}
                noindex={hasNoRoles}
            />

            <Breadcrumbs
                items={[
                    { label: 'Hjem', to: '/' },
                    { label: 'Person', to: '/' },
                    { label: decodedName },
                ]}
            />

            <div className="max-w-4xl mx-auto py-8 px-4">
                <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8">
                    <div className="bg-linear-to-br from-blue-900 via-blue-800 to-indigo-900 p-8 text-white">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-center gap-6">
                                <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20">
                                    <User className="h-12 w-12" />
                                </div>
                                <div>
                                    <h1 className="text-3xl font-bold mb-1">{decodedName}</h1>
                                    <div className="flex items-center gap-4 text-blue-100/90">
                                        {normalizedBirthdate && !hasNoRoles && (
                                            <span className="flex items-center gap-1.5 text-sm">
                                                {isYearOnly ? `Fødselsår: ${normalizedBirthdate}` : `Født: ${normalizedBirthdate}`}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1.5 text-sm px-2 py-0.5 bg-blue-500/30 rounded-full border border-blue-400/30">
                                            <ShieldCheck className="h-4 w-4" />
                                            Kun næringsvirksomhet
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    leftIcon={<img src={logo1881} alt="" className="h-4 w-auto" />}
                                    onClick={() => window.open(get1881SearchUrl(decodedName), '_blank', 'noopener,noreferrer')}
                                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 self-start md:self-center"
                                    aria-label={`Søk etter ${decodedName} på 1881.no`}
                                >
                                    Søk på 1881
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    leftIcon={<LinkedinIcon className="h-4 w-4" />}
                                    onClick={() => window.open(getLinkedInSearchUrl(decodedName, 'person'), '_blank', 'noopener,noreferrer')}
                                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 self-start md:self-center"
                                    aria-label={`Søk etter ${decodedName} på LinkedIn`}
                                >
                                    LinkedIn
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="p-8">
                        <div className="flex items-center gap-2 mb-6">
                            <Briefcase className="h-5 w-5 text-blue-600" />
                            <h2 className="text-xl font-bold text-gray-900">Roller og verv</h2>
                        </div>

                        {isLoading ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
                                ))}
                            </div>
                        ) : isError ? (
                            <div className="text-center py-12 bg-red-50 rounded-xl border border-red-100">
                                <p className="text-red-600 font-medium">Kunne ikke hente roller for denne personen.</p>
                            </div>
                        ) : roles?.length === 0 ? (
                            <div className="text-center py-12 bg-gray-50 rounded-xl border border-gray-100">
                                <User className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500 font-medium">Denne personen har ingen registrerte roller i næringsvirksomhet.</p>
                                <p className="text-gray-400 text-sm mt-2">
                                    Informasjonen kan ha blitt fjernet etter forespørsel, eller personen har kun roller i ikke-næringsdrivende enheter.
                                </p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {roles?.map((role, idx) => (
                                    <div
                                        key={`${role.orgnr}-${role.type_kode}-${idx}`}
                                        className="group p-5 rounded-xl border border-gray-100 bg-white hover:border-blue-200 hover:shadow-md transition-all flex items-center justify-between"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="p-3 bg-blue-50 rounded-lg text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                <Building2 className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                                                    {role.enhet_navn}
                                                </h3>
                                                <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                                                    <span className="font-medium text-blue-600/80 bg-blue-50 px-2 py-0.5 rounded">
                                                        {role.type_beskrivelse}
                                                    </span>
                                                    <span>•</span>
                                                    <span>Orgnr: {role.orgnr}</span>
                                                    {role.fratraadt && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="text-red-500 font-medium">Fratrådt</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <Link
                                            to="/virksomhet/$orgnr"
                                            params={{ orgnr: role.orgnr }}
                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                            title="Se virksomhetsprofil"
                                            aria-label={`Se virksomhetsprofil for ${role.enhet_navn}`}
                                        >
                                            <ExternalLink className="h-5 w-5" />
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mt-8 p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
                            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
                            <p className="text-sm text-amber-800 leading-relaxed">
                                <strong>Viktig informasjon:</strong> I tråd med Enhetsregisterloven § 22 viser vi kun roller knyttet til næringsvirksomhet.
                                Roller i frivillige organisasjoner, borettslag og andre ikke-næringsdrivende enheter er utelatt fra denne oversikten for å ivareta personvern og regelverk.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
