import { Link } from '@tanstack/react-router'
import type { PersonSearchResultDetailed } from '../../types/person'

export function PersonResultRow({ person }: { person: PersonSearchResultDetailed }) {
    const birthYear = person.birthdate ? person.birthdate.slice(0, 4) : null
    const topRole = person.top_roles[0]?.replace(/\s*\(\d+\)$/, '') ?? '—'
    const topCompany = person.notable_companies[0] ?? '—'

    return (
        <Link
            to="/person/$name/$birthdate"
            params={{
                name: person.name,
                birthdate: birthYear || 'unknown',
            }}
            className="group table-row transition-colors hover:bg-blue-50/50 dark:hover:bg-white/5"
        >
            <td className="px-4 py-3 text-sm font-medium text-gray-900 group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">
                {person.name}
            </td>
            <td className="hidden px-4 py-3 text-sm text-gray-600 dark:text-slate-400 sm:table-cell">
                {birthYear ?? '—'}
            </td>
            <td className="px-4 py-3 text-center text-sm text-gray-600 dark:text-slate-400">
                {person.active_role_count}
            </td>
            <td className="hidden px-4 py-3 text-center text-sm text-gray-600 dark:text-slate-400 md:table-cell">
                {person.role_count}
            </td>
            <td className="hidden px-4 py-3 text-sm text-gray-600 dark:text-slate-400 lg:table-cell">
                {topRole}
            </td>
            <td className="hidden max-w-48 truncate px-4 py-3 text-sm text-gray-600 dark:text-slate-400 lg:table-cell">
                {topCompany}
            </td>
        </Link>
    )
}
