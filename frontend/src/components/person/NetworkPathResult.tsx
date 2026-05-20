import { Building2, User, ArrowRight } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import type { NetworkPathResponse } from '../../types/person'

interface NetworkPathResultProps {
    result: NetworkPathResponse
}

/**
 * Visual display of a network path between two people.
 * Alternating person/company nodes connected by arrows.
 */
export function NetworkPathResult({ result }: NetworkPathResultProps) {
    if (!result.found) {
        return (
            <div className="rounded-xl border border-gray-100 bg-gray-50 py-8 text-center dark:border-slate-800 dark:bg-slate-950">
                <p className="font-medium text-gray-500 dark:text-slate-300">Ingen forbindelse funnet innen 3 steg.</p>
                <p className="mt-1 text-sm text-gray-400 dark:text-slate-500">
                    Personene deler ingen felles selskaper gjennom sitt rollenetteverk.
                </p>
            </div>
        )
    }

    return (
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                    Forbindelse funnet
                </span>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                    {result.depth} steg
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {result.path.map((node, i) => (
                    <div key={i} className="flex items-center gap-2">
                        {i > 0 && (
                            <ArrowRight className="h-4 w-4 shrink-0 text-gray-300 dark:text-slate-600" />
                        )}
                        {node.type === 'person' ? (
                            <PersonNode name={node.name} identifier={node.identifier} />
                        ) : (
                            <CompanyNode name={node.name} orgnr={node.identifier} role={node.role} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

function PersonNode({ name, identifier }: { name: string; identifier: string }) {
    const parts = identifier.split('|')
    const birthdate = parts[1] || null
    const birthYear = birthdate?.slice(0, 4) || null

    return (
        <Link
            to="/person/$name/$birthdate"
            params={{ name, birthdate: birthYear ?? 'unknown' }}
            className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 transition-colors hover:bg-blue-100 dark:border-blue-400/20 dark:bg-blue-500/15 dark:hover:bg-blue-500/20"
        >
            <User className="h-3.5 w-3.5 text-blue-600 dark:text-blue-200" />
            <span className="text-sm font-medium text-blue-800 dark:text-blue-100">{name}</span>
        </Link>
    )
}

function CompanyNode({ name, orgnr, role }: { name: string; orgnr: string; role: string | null }) {
    return (
        <Link
            to="/virksomhet/$orgnr"
            params={{ orgnr }}
            className="flex flex-col items-center rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 transition-colors hover:bg-purple-100 dark:border-violet-400/20 dark:bg-violet-500/15 dark:hover:bg-violet-500/20"
        >
            <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-purple-600 dark:text-violet-200" />
                <span className="text-sm font-medium text-purple-800 dark:text-violet-100">{name}</span>
            </div>
            {role && (
                <span className="mt-0.5 text-[10px] text-purple-500 dark:text-violet-300">{role}</span>
            )}
        </Link>
    )
}
