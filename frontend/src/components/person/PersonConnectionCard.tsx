import { memo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronRight, Users, ExternalLink } from 'lucide-react'
import type { PersonConnection } from '../../types/person'

interface PersonConnectionCardProps {
    connection: PersonConnection
    defaultExpanded?: boolean
    /** Name of the person whose page we're viewing */
    personName: string
}

export const PersonConnectionCard = memo(function PersonConnectionCard({
    connection,
    defaultExpanded = false,
    personName,
}: PersonConnectionCardProps) {
    const [expanded, setExpanded] = useState(defaultExpanded)

    return (
        <div className="rounded-xl border border-gray-100 bg-white transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:shadow-black/30">
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
                className="w-full p-5 flex items-start justify-between gap-4 text-left"
            >
                <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className="shrink-0 rounded-lg bg-purple-50 p-3 text-purple-600 dark:bg-violet-500/15 dark:text-violet-200">
                        <Users className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="truncate font-bold text-gray-900 dark:text-white">{connection.name}</h3>
                        <div className="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
                            {connection.birth_year && (
                                <>
                                    <span>f. {connection.birth_year}</span>
                                    <span className="text-gray-300 dark:text-slate-600">•</span>
                                </>
                            )}
                            <span className="rounded bg-purple-50 px-2 py-0.5 font-medium text-purple-600/80 dark:bg-violet-500/15 dark:text-violet-200">
                                {connection.shared_company_count} felles {connection.shared_company_count === 1 ? 'selskap' : 'selskaper'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="shrink-0 p-2 text-gray-400 dark:text-slate-500">
                    {expanded ? <ChevronDown className="h-5 w-5" aria-hidden="true" /> : <ChevronRight className="h-5 w-5" aria-hidden="true" />}
                </div>
            </button>

            {expanded && (
                <div className="border-t border-gray-50 px-5 pb-5 dark:border-slate-800">
                    <div className="mt-3 space-y-2">
                        {connection.shared_companies.map((sc) => (
                            <div key={sc.orgnr} className="flex items-center justify-between gap-3 text-sm">
                                <div className="min-w-0 flex-1">
                                    <Link
                                        to="/virksomhet/$orgnr"
                                        params={{ orgnr: sc.orgnr }}
                                        className="font-medium text-gray-700 transition-colors hover:text-blue-600 dark:text-slate-300 dark:hover:text-blue-300"
                                    >
                                        {sc.navn}
                                    </Link>
                                    <div className="mt-0.5 text-xs text-gray-400 dark:text-slate-500">
                                        {personName.split(' ')[0]}: {sc.person_role} · {connection.name.split(' ')[0]}: {sc.connection_role}
                                    </div>
                                </div>
                                <Link
                                    to="/virksomhet/$orgnr"
                                    params={{ orgnr: sc.orgnr }}
                                    className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-all hover:bg-blue-50 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-blue-500/15 dark:hover:text-blue-300"
                                    title="Se virksomhetsprofil"
                                    aria-label={`Se virksomhetsprofil for ${sc.navn}`}
                                >
                                    <ExternalLink className="h-4 w-4" aria-hidden="true" />
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
})
