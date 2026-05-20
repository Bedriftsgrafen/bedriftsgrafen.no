import { memo, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { Trophy, Medal, Award } from 'lucide-react'
import { formatCategoryValue } from './toplistFormatters'
import { formatNumber } from '../../utils/formatters'
import type { PersonToplistResponse, ToplistCategory } from '../../types/person'

const CATEGORIES: { key: ToplistCategory; label: string }[] = [
    { key: 'salgsinntekter', label: 'Omsetning' },
    { key: 'total_profit', label: 'Overskudd' },
    { key: 'total_employees', label: 'Ansatte' },
    { key: 'DAGL', label: 'Daglig leder' },
    { key: 'active_companies', label: 'Virksomheter' },
    { key: 'industry_diversity', label: 'Bransjemangfold' },
    { key: 'LEDE', label: 'Styreleder' },
    { key: 'MEDL', label: 'Styremedlem' },
    { key: 'active_roles', label: 'Aktive roller' },
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
                        className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                            selectedCategory === cat.key
                            ? 'border-blue-300 bg-blue-50 font-medium text-blue-700 dark:border-blue-400/30 dark:bg-blue-500/15 dark:text-blue-200'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700'
                        }`}
                    >
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Ranked table */}
            {activeList && (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                                <th className="text-left px-4 py-3 w-12">#</th>
                                <th className="text-left px-4 py-3">Navn</th>
                                <th className="text-right px-4 py-3">Verdi</th>
                                <th className="text-right px-4 py-3 hidden sm:table-cell">Aktive roller</th>
                                <th className="text-right px-4 py-3 hidden md:table-cell">Virksomheter</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeList.entries.map((entry, i) => (
                                <tr
                                    key={`${entry.name}-${entry.birth_year}`}
                                    className="border-b border-slate-50 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-white/5"
                                >
                                    <td className="px-4 py-2.5 text-sm">
                                        {i < 3 ? RANK_ICONS[i] : (
                                            <span className="text-slate-400 dark:text-slate-500">{entry.rank}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5">
                                        <Link
                                            to="/person/$name/$birthdate"
                                            params={{ name: entry.name, birthdate: String(entry.birth_year ?? '') }}
                                            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-300"
                                        >
                                            {entry.name}
                                        </Link>
                                        {entry.birth_year && (
                                            <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500">f. {entry.birth_year}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5 text-right text-sm font-medium tabular-nums text-slate-900 dark:text-slate-100">
                                        {formatCategoryValue(selectedCategory, entry.value)}
                                    </td>
                                    <td className="hidden px-4 py-2.5 text-right text-sm tabular-nums text-slate-500 dark:text-slate-400 sm:table-cell">
                                        {formatNumber(entry.active_roles)}
                                    </td>
                                    <td className="hidden px-4 py-2.5 text-right text-sm tabular-nums text-slate-500 dark:text-slate-400 md:table-cell">
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
