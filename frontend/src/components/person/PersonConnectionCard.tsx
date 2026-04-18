import { memo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { ChevronDown, ChevronRight, Users, ExternalLink } from 'lucide-react'
import type { PersonConnection } from '../../types/person'

interface PersonConnectionCardProps {
    connection: PersonConnection
    defaultExpanded?: boolean
}

export const PersonConnectionCard = memo(function PersonConnectionCard({
    connection,
    defaultExpanded = false,
}: PersonConnectionCardProps) {
    const [expanded, setExpanded] = useState(defaultExpanded)

    return (
        <div className="rounded-xl border border-gray-100 bg-white hover:shadow-md transition-all">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full p-5 flex items-start justify-between gap-4 text-left"
            >
                <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className="p-3 rounded-lg shrink-0 bg-purple-50 text-purple-600">
                        <Users className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 truncate">{connection.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                            {connection.birth_year && (
                                <>
                                    <span>f. {connection.birth_year}</span>
                                    <span className="text-gray-300">•</span>
                                </>
                            )}
                            <span className="font-medium text-purple-600/80 bg-purple-50 px-2 py-0.5 rounded">
                                {connection.shared_company_count} felles {connection.shared_company_count === 1 ? 'selskap' : 'selskaper'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="p-2 text-gray-400 shrink-0">
                    {expanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </div>
            </button>

            {expanded && (
                <div className="px-5 pb-5 border-t border-gray-50">
                    <div className="mt-3 space-y-2">
                        {connection.shared_companies.map((sc) => (
                            <div key={sc.orgnr} className="flex items-center justify-between gap-3 text-sm">
                                <div className="min-w-0 flex-1">
                                    <Link
                                        to="/virksomhet/$orgnr"
                                        params={{ orgnr: sc.orgnr }}
                                        className="font-medium text-gray-700 hover:text-blue-600 transition-colors"
                                    >
                                        {sc.navn}
                                    </Link>
                                    <div className="text-xs text-gray-400 mt-0.5">
                                        Du: {sc.person_role} · {connection.name.split(' ')[0]}: {sc.connection_role}
                                    </div>
                                </div>
                                <Link
                                    to="/virksomhet/$orgnr"
                                    params={{ orgnr: sc.orgnr }}
                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all shrink-0"
                                    title="Se virksomhetsprofil"
                                >
                                    <ExternalLink className="h-4 w-4" />
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
})
