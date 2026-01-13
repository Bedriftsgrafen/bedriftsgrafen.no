import React, { useState, useMemo, useCallback, useEffect } from 'react'
import { Users, Briefcase, Building2, AlertCircle, Loader, RefreshCw, Crown, User, UserCheck, ChevronDown, Calendar, ExternalLink } from 'lucide-react'
import { useRolesQuery, type Role } from '../../hooks/queries/useRolesQuery'
import { Link } from '@tanstack/react-router'

interface RolesTabProps {
    orgnr: string
}

// Role type configuration with icons, colors, and display labels
const ROLE_CONFIG: Record<string, { icon: typeof Users; label: string; sectionTitle: string; color: string }> = {
    INNH: { icon: Crown, label: 'Innehaver', sectionTitle: 'Innehaver', color: 'text-amber-600' },
    DAGL: { icon: Briefcase, label: 'Daglig leder', sectionTitle: 'Daglig ledelse', color: 'text-blue-600' },
    LEDE: { icon: Crown, label: 'Styreleder', sectionTitle: 'Styreleder', color: 'text-amber-600' },
    MEDL: { icon: Users, label: 'Styremedlem', sectionTitle: 'Styremedlemmer', color: 'text-gray-600' },
    VARA: { icon: UserCheck, label: 'Varamedlem', sectionTitle: 'Varamedlemmer', color: 'text-gray-500' },
    NEST: { icon: Crown, label: 'Nestleder', sectionTitle: 'Nestleder', color: 'text-amber-500' },
    KONT: { icon: User, label: 'Kontaktperson', sectionTitle: 'Kontaktpersoner', color: 'text-green-600' },
    REPR: { icon: User, label: 'Representant', sectionTitle: 'Representanter', color: 'text-purple-600' },
    REVI: { icon: Building2, label: 'Revisor', sectionTitle: 'Revisor', color: 'text-indigo-600' },
    REGN: { icon: Building2, label: 'Regnskapsfører', sectionTitle: 'Regnskapsfører', color: 'text-teal-600' },
}

// Priority order for displaying role groups
const ROLE_PRIORITY = ['INNH', 'DAGL', 'LEDE', 'NEST', 'MEDL', 'VARA', 'KONT', 'REPR', 'REVI', 'REGN']

function getRoleConfig(typeKode: string | null) {
    return ROLE_CONFIG[typeKode || ''] || { icon: User, label: typeKode || 'Ukjent', sectionTitle: typeKode || 'Annet', color: 'text-gray-500' }
}

// Format date for display (moved outside component for efficiency)
function formatDate(dateStr: string | null): string | null {
    if (!dateStr) return null
    try {
        const date = new Date(dateStr)
        return date.toLocaleDateString('nb-NO', { year: 'numeric', month: 'long', day: 'numeric' })
    } catch {
        return dateStr
    }
}

// Group roles by type and return with count of active roles
function groupRoles(roles: Role[]): { groups: [string, Role[]][]; activeCount: number } {
    const groups: Record<string, Role[]> = {}
    let activeCount = 0

    for (const role of roles) {
        if (role.fratraadt) continue // Skip resigned roles
        activeCount++
        const key = role.type_kode || 'OTHER'
        if (!groups[key]) groups[key] = []
        groups[key].push(role)
    }

    // Sort groups by priority using ROLE_PRIORITY constant
    const sorted: [string, Role[]][] = []

    for (const key of ROLE_PRIORITY) {
        if (groups[key]) sorted.push([key, groups[key]])
    }

    // Add any remaining groups not in priority list
    for (const [key, value] of Object.entries(groups)) {
        if (!ROLE_PRIORITY.includes(key)) sorted.push([key, value])
    }

    return { groups: sorted, activeCount }
}

function RoleCard({ role }: { role: Role }) {
    const [isExpanded, setIsExpanded] = useState(false)
    const config = getRoleConfig(role.type_kode)
    const Icon = config.icon

    // Build person profile URL params
    const personProfileParams = role.person_navn ? {
        name: role.person_navn,
        birthdate: role.foedselsdato || 'unknown'
    } : null

    const toggleExpanded = () => setIsExpanded(!isExpanded)
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggleExpanded()
        }
    }

    return (
        <div
            role="button"
            tabIndex={0}
            aria-expanded={isExpanded}
            className={`bg-white border rounded-lg transition-all cursor-pointer ${isExpanded ? 'border-blue-300 shadow-md' : 'border-gray-200 hover:border-blue-200'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1`}
            onClick={toggleExpanded}
            onKeyDown={handleKeyDown}
        >
            <div className="flex items-center gap-3 p-3">
                <div className={`p-2 rounded-lg bg-gray-50 ${config.color}`}>
                    <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                        {role.person_navn || role.enhet_navn || 'Ukjent'}
                    </div>
                    <div className="text-xs text-gray-500">
                        {role.type_beskrivelse || config.label}
                    </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </div>

            {isExpanded && (
                <div className="px-3 pb-3 pt-0 border-t border-gray-100 mt-1 space-y-2 text-xs">
                    {role.foedselsdato && (
                        <div className="flex items-center gap-2 text-gray-600">
                            <Calendar className="h-3 w-3 text-gray-400" />
                            <span>Født: {formatDate(role.foedselsdato)}</span>
                        </div>
                    )}
                    {role.enhet_orgnr && (
                        <div className="flex items-center gap-2 text-gray-600">
                            <Building2 className="h-3 w-3 text-gray-400" />
                            <span>Org.nr: {role.enhet_orgnr}</span>
                        </div>
                    )}
                    {role.enhet_navn && role.person_navn && (
                        <div className="flex items-center gap-2 text-gray-600">
                            <Building2 className="h-3 w-3 text-gray-400" />
                            <span>{role.enhet_navn}</span>
                        </div>
                    )}
                    {role.rekkefoelge !== null && role.rekkefoelge !== undefined && (
                        <div className="flex items-center gap-2 text-gray-600">
                            <span className="text-gray-400">#</span>
                            <span>Rekkefølge: {role.rekkefoelge}</span>
                        </div>
                    )}
                    {!role.foedselsdato && !role.enhet_orgnr && role.rekkefoelge === null && !personProfileParams && (
                        <div className="text-gray-400 italic">Ingen tilleggsinfo tilgjengelig</div>
                    )}

                    {/* Link to person profile */}
                    {personProfileParams && (
                        <Link
                            to="/person/$name/$birthdate"
                            params={personProfileParams}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-2 flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-xs font-medium group"
                        >
                            <ExternalLink className="h-3 w-3 group-hover:scale-110 transition-transform" />
                            Se alle roller for {role.person_navn}
                        </Link>
                    )}
                </div>
            )}
        </div>
    )
}

function RoleSection({ title, roles, icon: Icon }: { title: string; roles: Role[]; icon: typeof Users }) {
    return (
        <div className="space-y-2">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                <Icon className="h-4 w-4" />
                {title}
                <span className="text-gray-400 font-normal">({roles.length})</span>
            </h4>
            <div className="grid gap-2 sm:grid-cols-2">
                {roles.map((role, idx) => (
                    <RoleCard key={`${role.type_kode}-${role.person_navn}-${idx}`} role={role} />
                ))}
            </div>
        </div>
    )
}

export function RolesTab({ orgnr }: RolesTabProps) {
    const [isManualFetching, setIsManualFetching] = useState(false)
    const [cooldown, setCooldown] = useState(false)
    const [fetchError, setFetchError] = useState<string | null>(null)
    const { data: roles, isLoading, isError, error, fetchFromBrreg } = useRolesQuery(orgnr)

    // Cooldown timer
    useEffect(() => {
        if (cooldown) {
            const timer = setTimeout(() => setCooldown(false), 15000)
            return () => clearTimeout(timer)
        }
    }, [cooldown])

    const handleFetchFromBrreg = useCallback(async () => {
        if (cooldown) return
        setIsManualFetching(true)
        setFetchError(null)
        try {
            await fetchFromBrreg()
            setCooldown(true)
        } catch (err) {
            setFetchError(err instanceof Error ? err.message : 'Kunne ikke hente fra Brønnøysund')
        } finally {
            setIsManualFetching(false)
        }
    }, [fetchFromBrreg, cooldown])

    // Memoize grouped roles - must be before early returns (hooks rules)
    const { groups: groupedRoles, activeCount } = useMemo(
        () => groupRoles(roles || []),
        [roles]
    )

    const isBusy = isLoading || isManualFetching

    if (isLoading) {
        return (
            <div className="p-12 text-center">
                <Loader className="h-8 w-8 text-blue-600 mx-auto mb-4 animate-spin" />
                <p className="text-gray-600">Laster roller...</p>
            </div>
        )
    }

    if (isError || fetchError) {
        const errorMessage = fetchError || (error instanceof Error ? error.message : 'Prøv igjen senere')
        return (
            <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <div>
                        <p className="font-medium">Kunne ikke laste roller</p>
                        <p className="text-sm text-red-600 mt-1">{errorMessage}</p>
                    </div>
                </div>
                <button
                    onClick={handleFetchFromBrreg}
                    disabled={isBusy}
                    className="ml-4 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 whitespace-nowrap inline-flex items-center gap-2"
                >
                    {isBusy && <Loader className="h-3 w-3 animate-spin" />}
                    {isBusy ? 'Henter...' : 'Prøv igjen'}
                </button>
            </div>
        )
    }

    if (!roles || roles.length === 0) {
        return (
            <div className="p-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600 font-medium mb-1">Ingen roller funnet</p>
                <p className="text-sm text-gray-500 mb-4">
                    Denne bedriften har ingen registrerte roller i Brønnøysundregistrene.
                </p>
                <button
                    onClick={handleFetchFromBrreg}
                    disabled={isBusy}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
                >
                    {isBusy && <Loader className="h-3 w-3 animate-spin" />}
                    {isBusy ? 'Henter fra Brønnøysund...' : 'Hent fra Brønnøysund'}
                </button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    {activeCount} roller
                </h3>
                <button
                    onClick={handleFetchFromBrreg}
                    disabled={isBusy || cooldown}
                    className="px-2 py-1 text-sm text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors inline-flex items-center gap-1 disabled:opacity-70 disabled:cursor-not-allowed"
                    title={cooldown ? "Nylig oppdatert" : "Oppdater fra Brønnøysund"}
                >
                    {isBusy ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <RefreshCw className={`h-3.5 w-3.5 ${cooldown ? 'text-green-600' : ''}`} />
                    )}
                    {isBusy ? 'Oppdaterer...' : cooldown ? 'Oppdatert' : 'Oppdater'}
                </button>
            </div>

            {groupedRoles.map(([typeKode, rolesInGroup]: [string, Role[]]) => {
                const config = getRoleConfig(typeKode)
                return (
                    <RoleSection
                        key={typeKode}
                        title={config.sectionTitle}
                        roles={rolesInGroup}
                        icon={config.icon}
                    />
                )
            })}
        </div>
    )
}
