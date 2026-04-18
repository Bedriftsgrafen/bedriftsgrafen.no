/* eslint-disable react-refresh/only-export-components */
import { createLazyFileRoute } from '@tanstack/react-router'
import { useState, useCallback, useMemo } from 'react'
import { User, ShieldCheck, Briefcase, Users, LayoutDashboard, AlertTriangle, Network } from 'lucide-react'
import { SEOHead, Breadcrumbs } from '../components/layout'
import { TabContainer } from '../components/common/TabContainer'
import { TabButton } from '../components/common/TabButton'
import { usePersonRolesQuery } from '../hooks/queries/usePersonRolesQuery'
import { usePersonConnectionsQuery } from '../hooks/queries/usePersonConnectionsQuery'
import { usePersonSparklineQuery } from '../hooks/queries/usePersonSparklineQuery'
import { useSlowLoadingToast } from '../hooks/useSlowLoadingToast'
import { Button } from '../components/common/Button'
import {
    PersonSummaryStats,
    PersonRoleGroups,
    PersonConnectionsList,
    PersonRoleFilters,
    PersonIndustryChart,
    PersonNetworkSearch,
} from '../components/person'
import type { PersonRole, CompanySparklineData } from '../types/person'
import logo1881 from '../img/1881-logo.png'
import { get1881SearchUrl, getLinkedInSearchUrl, formatLargeCurrency } from '../utils/formatters'

const LinkedinIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
)

type TabType = 'oversikt' | 'roller' | 'forbindelser' | 'nettverkssok'

export const Route = createLazyFileRoute('/person/$name/$birthdate')({
    component: PersonProfilePage,
})

function TopCompaniesByRevenue({ roles }: { roles: PersonRole[] }) {
    const top5 = roles
        .filter((r) => !r.fratraadt && r.latest_salgsinntekter !== null)
        .sort((a, b) => (b.latest_salgsinntekter ?? 0) - (a.latest_salgsinntekter ?? 0))
        .slice(0, 5)

    if (top5.length === 0) return null

    return (
        <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Største selskaper etter omsetning
            </h3>
            <div className="space-y-2">
                {top5.map((r) => (
                    <div key={`${r.orgnr}-${r.type_kode}`} className="flex items-center justify-between text-sm">
                        <div className="min-w-0 flex-1">
                            <span className="font-medium text-gray-900 truncate">{r.enhet_navn}</span>
                            {r.organisasjonsform && (
                                <span className="text-xs text-gray-400 ml-1.5">{r.organisasjonsform}</span>
                            )}
                        </div>
                        <span className="text-gray-500 font-medium shrink-0 ml-3">
                            {formatLargeCurrency(r.latest_salgsinntekter)}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function PersonProfilePage() {
    const { name, birthdate } = Route.useParams()
    const decodedName = decodeURIComponent(name)
    const normalizedBirthdate = birthdate === 'unknown' ? null : birthdate
    const isYearOnly = normalizedBirthdate ? /^\d{4}$/.test(normalizedBirthdate) : false

    const [activeTab, setActiveTab] = useState<TabType>('oversikt')
    const [filteredRoles, setFilteredRoles] = useState<PersonRole[] | null>(null)

    const {
        data: roles,
        isLoading,
        isError,
    } = usePersonRolesQuery(decodedName, normalizedBirthdate)

    const {
        data: connections,
        isLoading: connectionsLoading,
    } = usePersonConnectionsQuery(decodedName, normalizedBirthdate, activeTab === 'forbindelser')

    const { data: sparklineData } = usePersonSparklineQuery(
        decodedName, normalizedBirthdate, activeTab === 'roller'
    )

    useSlowLoadingToast(isLoading, 'Henter rolleoversikt...')

    // Build sparkline lookup map by orgnr
    const sparklineMap = useMemo(() => {
        if (!sparklineData) return new Map<string, CompanySparklineData>()
        return new Map(sparklineData.map((s) => [s.orgnr, s]))
    }, [sparklineData])

    const handleFilteredRoles = useCallback((roles: PersonRole[]) => {
        setFilteredRoles(roles)
    }, [])

    const hasNoRoles = !isLoading && !isError && roles?.length === 0
    const activeRoleCount = roles?.filter((r) => !r.fratraadt).length ?? 0
    const connectionCount = connections?.length ?? 0

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
                    <div className="bg-linear-to-br from-blue-900 via-blue-800 to-indigo-900 p-5 md:p-8 text-white">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-center gap-6">
                                <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20">
                                    <User className="h-12 w-12" />
                                </div>
                                <div>
                                    <h1 className="text-2xl md:text-3xl font-bold mb-1">{decodedName}</h1>
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
                            <>
                                <TabContainer>
                                    <TabButton
                                        active={activeTab === 'oversikt'}
                                        icon={<LayoutDashboard className="h-4 w-4" />}
                                        label="Oversikt"
                                        onClick={() => setActiveTab('oversikt')}
                                    />
                                    <TabButton
                                        active={activeTab === 'roller'}
                                        icon={<Briefcase className="h-4 w-4" />}
                                        label="Roller"
                                        onClick={() => setActiveTab('roller')}
                                        badge={activeRoleCount}
                                        badgeColor="blue"
                                    />
                                    <TabButton
                                        active={activeTab === 'forbindelser'}
                                        icon={<Users className="h-4 w-4" />}
                                        label="Forbindelser"
                                        onClick={() => setActiveTab('forbindelser')}
                                        badge={connectionCount}
                                        badgeColor="green"
                                    />
                                    <TabButton
                                        active={activeTab === 'nettverkssok'}
                                        icon={<Network className="h-4 w-4" />}
                                        label="Nettverkssøk"
                                        onClick={() => setActiveTab('nettverkssok')}
                                    />
                                </TabContainer>

                                <div role="tabpanel" aria-label={activeTab}>
                                    {activeTab === 'oversikt' && (
                                        <>
                                            <PersonSummaryStats roles={roles!} />
                                            <TopCompaniesByRevenue roles={roles!} />
                                            <PersonIndustryChart roles={roles!} />
                                        </>
                                    )}

                                    {activeTab === 'roller' && (
                                        <>
                                            <PersonRoleFilters roles={roles!} onFilteredRoles={handleFilteredRoles} />
                                            <div className="mt-4">
                                                <PersonRoleGroups roles={filteredRoles ?? roles!} sparklineMap={sparklineMap} />
                                            </div>
                                        </>
                                    )}

                                    {activeTab === 'forbindelser' && (
                                        <PersonConnectionsList
                                            connections={connections ?? []}
                                            isLoading={connectionsLoading}
                                            personName={decodedName}
                                        />
                                    )}

                                    {activeTab === 'nettverkssok' && (
                                        <PersonNetworkSearch
                                            initialPersonA={{
                                                name: decodedName,
                                                birthdate: normalizedBirthdate,
                                            }}
                                        />
                                    )}
                                </div>
                            </>
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
