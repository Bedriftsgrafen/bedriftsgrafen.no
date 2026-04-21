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
            className="group table-row hover:bg-blue-50/50 transition-colors"
        >
            <td className="px-4 py-3 text-sm font-medium text-gray-900 group-hover:text-blue-700">
                {person.name}
            </td>
            <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                {birthYear ?? '—'}
            </td>
            <td className="px-4 py-3 text-sm text-gray-600 text-center">
                {person.active_role_count}
            </td>
            <td className="px-4 py-3 text-sm text-gray-600 text-center hidden md:table-cell">
                {person.role_count}
            </td>
            <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">
                {topRole}
            </td>
            <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell truncate max-w-48">
                {topCompany}
            </td>
        </Link>
    )
}
