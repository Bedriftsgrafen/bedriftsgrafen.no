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
            className="group block rounded-xl border border-gray-100 bg-white p-5 transition-all hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-400/30 dark:hover:shadow-black/30"
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 min-w-0">
                    <div className="shrink-0 rounded-lg bg-blue-50 p-3 text-blue-900 transition-colors group-hover:bg-blue-900 group-hover:text-white dark:bg-blue-500/15 dark:text-blue-200 dark:group-hover:bg-blue-500 dark:group-hover:text-slate-950">
                        <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="truncate font-bold text-gray-900 transition-colors group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">
                            {person.name}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-slate-400">
                            {birthYear && (
                                <span>Fødselsår: {birthYear}</span>
                            )}
                            <span className="flex items-center gap-1">
                                <Briefcase className="h-3.5 w-3.5" />
                                {person.active_role_count} aktiv{person.active_role_count !== 1 ? 'e' : ''} rolle{person.active_role_count !== 1 ? 'r' : ''}
                                {resignedCount > 0 && (
                                    <span className="text-gray-400 dark:text-slate-500">({resignedCount} fratrådt)</span>
                                )}
                            </span>
                        </div>

                        {/* Top roles */}
                        {person.top_roles.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {person.top_roles.map((role) => (
                                    <span
                                        key={role}
                                        className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600/80 dark:bg-blue-500/15 dark:text-blue-200"
                                    >
                                        {role}
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Notable companies */}
                        {person.notable_companies.length > 0 && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500 dark:text-slate-400">
                                <Building2 className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">
                                    {person.notable_companies.join(', ')}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="shrink-0 p-2 text-gray-400 transition-colors group-hover:text-blue-600 dark:text-slate-500 dark:group-hover:text-blue-300">
                    <ArrowRight className="h-5 w-5" />
                </div>
            </div>
        </Link>
    )
}
