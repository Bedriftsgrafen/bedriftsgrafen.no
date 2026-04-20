import { memo, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { Trophy, Medal, Award } from 'lucide-react'
import { formatNumber } from '../../utils/formatters'
import type { PersonToplistResponse, ToplistCategory } from '../../types/person'

const CATEGORIES: { key: ToplistCategory; label: string }[] = [
    { key: 'active_roles', label: 'Aktive roller' },
    { key: 'LEDE', label: 'Styreleder' },
    { key: 'DAGL', label: 'Daglig leder' },
    { key: 'MEDL', label: 'Styremedlem' },
    { key: 'active_companies', label: 'Selskaper' },
    { key: 'industry_diversity', label: 'Bransjemangfold' },
]

const RANK_ICONS = [
    <Trophy key="1" className="h-4 w-4 text-amber-500" />,
    <Medal key="2" className="h-4 w-4 text-slate-400" />,
    <Award key="3" className="h-4 w-4 text-amber-700" />,
]

interface PersonToplistTabProps {
    toplists: PersonToplistResponse[]
    selectedCategory: ToplistCategory
    onCategoryChange: (category: ToplistCategory) => void
}

export const PersonToplistTab = memo(function PersonToplistTab({
    toplists,
    selectedCategory,
    onCategoryChange,
}: PersonToplistTabProps) {
    const activeList = useMemo(
        () => toplists.find(l => l.category === selectedCategory),
        [toplists, selectedCategory]
    )

    return (
        <div className="space-y-4">
            {/* Category picker */}
            <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat.key}
                        onClick={() => onCategoryChange(cat.key)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                            selectedCategory === cat.key
                                ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium'
                                : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Ranked table */}
            {activeList && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wider">
                                <th className="text-left px-4 py-3 w-12">#</th>
                                <th className="text-left px-4 py-3">Navn</th>
                                <th className="text-right px-4 py-3">Verdi</th>
                                <th className="text-right px-4 py-3 hidden sm:table-cell">Aktive roller</th>
                                <th className="text-right px-4 py-3 hidden md:table-cell">Selskaper</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeList.entries.map((entry, i) => (
                                <tr
                                    key={`${entry.name}-${entry.birth_year}`}
                                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                                >
                                    <td className="px-4 py-2.5 text-sm">
                                        {i < 3 ? RANK_ICONS[i] : (
                                            <span className="text-slate-400">{entry.rank}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <Link
                                            to="/person/$name/$birthdate"
                                            params={{ name: entry.name, birthdate: String(entry.birth_year ?? '') }}
                                            className="text-sm text-blue-600 hover:underline font-medium"
                                        >
                                            {entry.name}
                                        </Link>
                                        {entry.birth_year && (
                                            <span className="text-xs text-slate-400 ml-1.5">f. {entry.birth_year}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5 text-sm text-right font-medium text-slate-900 tabular-nums">
                                        {formatNumber(entry.value)}
                                    </td>
                                    <td className="px-4 py-2.5 text-sm text-right text-slate-500 tabular-nums hidden sm:table-cell">
                                        {formatNumber(entry.active_roles)}
                                    </td>
                                    <td className="px-4 py-2.5 text-sm text-right text-slate-500 tabular-nums hidden md:table-cell">
                                        {formatNumber(entry.active_companies)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
})
