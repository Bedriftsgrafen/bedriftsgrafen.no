import { Link } from '@tanstack/react-router'
import { User, Building2, ArrowRight, Briefcase } from 'lucide-react'
import type { PersonSearchResultDetailed } from '../../types/person'

export function PersonResultCard({ person }: { person: PersonSearchResultDetailed }) {
    const birthYear = person.birthdate ? person.birthdate.slice(0, 4) : null
    const resignedCount = person.role_count - person.active_role_count

    return (
        <Link
            to="/person/$name/$birthdate"
            params={{
                name: person.name,
                birthdate: birthYear || 'unknown',
            }}
            className="group block p-5 rounded-xl border border-gray-100 bg-white hover:border-blue-200 hover:shadow-md transition-all"
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                    <div className="p-3 bg-blue-50 rounded-lg text-blue-900 group-hover:bg-blue-900 group-hover:text-white transition-colors shrink-0">
                        <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors truncate">
                            {person.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 mt-1">
                            {birthYear && (
                                <span>Fødselsår: {birthYear}</span>
                            )}
                            <span className="flex items-center gap-1">
                                <Briefcase className="h-3.5 w-3.5" />
                                {person.active_role_count} aktiv{person.active_role_count !== 1 ? 'e' : ''} rolle{person.active_role_count !== 1 ? 'r' : ''}
                                {resignedCount > 0 && (
                                    <span className="text-gray-400">({resignedCount} fratrådt)</span>
                                )}
                            </span>
                        </div>

                        {/* Top roles */}
                        {person.top_roles.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {person.top_roles.map((role) => (
                                    <span
                                        key={role}
                                        className="text-xs font-medium text-blue-600/80 bg-blue-50 px-2 py-0.5 rounded"
                                    >
                                        {role}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Notable companies */}
                        {person.notable_companies.length > 0 && (
                            <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                                <Building2 className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">
                                    {person.notable_companies.join(', ')}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="shrink-0 p-2 text-gray-400 group-hover:text-blue-600 transition-colors">
                    <ArrowRight className="h-5 w-5" />
                </div>
            </div>
        </Link>
    )
}
