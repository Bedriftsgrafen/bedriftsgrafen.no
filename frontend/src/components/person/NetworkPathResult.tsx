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
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-gray-500 font-medium">Ingen forbindelse funnet innen 3 steg.</p>
                <p className="text-gray-400 text-sm mt-1">
                    Personene deler ingen felles selskaper gjennom sitt rollenetteverk.
                </p>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-semibold text-gray-700">
                    Forbindelse funnet
                </span>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                    {result.depth} steg
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {result.path.map((node, i) => (
                    <div key={i} className="flex items-center gap-2">
                        {i > 0 && (
                            <ArrowRight className="h-4 w-4 text-gray-300 shrink-0" />
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
        >
            <User className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">{name}</span>
        </Link>
    )
}

function CompanyNode({ name, orgnr, role }: { name: string; orgnr: string; role: string | null }) {
    return (
        <Link
            to="/virksomhet/$orgnr"
            params={{ orgnr }}
            className="flex flex-col items-center px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
        >
            <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-purple-600" />
                <span className="text-sm font-medium text-purple-800">{name}</span>
            </div>
            {role && (
                <span className="text-[10px] text-purple-500 mt-0.5">{role}</span>
            )}
        </Link>
    )
}
