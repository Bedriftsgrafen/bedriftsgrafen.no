import { memo } from 'react'
import { Link } from '@tanstack/react-router'
import { Trophy } from 'lucide-react'
import { formatCurrency, formatNumber } from '../../utils/formatters'
import { PersonGenerationChart } from './PersonGenerationChart'
import { PersonRoleTypeChart } from './PersonRoleTypeChart'
import type { PersonToplistResponse, PersonAggregateStats, ToplistCategory } from '../../types/person'

const CATEGORY_LABELS: Record<ToplistCategory, string> = {
    active_roles: 'Flest aktive roller',
    LEDE: 'Flest styreleder',
    DAGL: 'Flest daglig leder',
    MEDL: 'Flest styremedlem',
    active_companies: 'Flest selskaper',
    industry_diversity: 'Mest bransjemangfold',
    salgsinntekter: 'Størst omsetning',
}

interface PersonOverviewTabProps {
    toplists: PersonToplistResponse[]
    stats: PersonAggregateStats | undefined
    onTabChange: (tab: 'oversikt' | 'topplister' | 'sok') => void
}

export const PersonOverviewTab = memo(function PersonOverviewTab({ toplists, stats, onTabChange }: PersonOverviewTabProps) {
    return (
        <div className="space-y-8">
            {/* Mini toplists (top 5 per category) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {toplists.map(list => (
                    <div
                        key={list.category}
                        className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition-shadow"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                                <Trophy className="h-4 w-4 text-amber-500" />
                                {CATEGORY_LABELS[list.category]}
                            </h3>
                            <button
                                onClick={() => onTabChange('topplister')}
                                className="text-xs text-blue-600 hover:underline"
                            >
                                Se alle
                            </button>
                        </div>
                        <ol className="space-y-1.5">
                            {list.entries.slice(0, 5).map((entry, i) => (
                                <li key={`${entry.name}-${entry.birth_year}`} className="flex items-center gap-2 text-sm">
                                    <span className="text-slate-400 font-medium w-5 text-right">{i + 1}.</span>
                                    <Link
                                        to="/person/$name/$birthdate"
                                        params={{ name: entry.name, birthdate: String(entry.birth_year ?? '') }}
                                        className="text-blue-600 hover:underline truncate flex-1"
                                    >
                                        {entry.name}
                                    </Link>
                                    <span className="text-slate-500 font-medium tabular-nums shrink-0">
                                        {list.category === 'salgsinntekter'
                                            ? formatCurrency(entry.value)
                                            : formatNumber(entry.value)}
                                    </span>
                                </li>
                            ))}
                        </ol>
                    </div>
                ))}
            </div>

            {/* Charts */}
            {stats && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <PersonGenerationChart data={stats.generation_distribution} />
                    <PersonRoleTypeChart data={stats.role_type_distribution} />
                </div>
            )}
        </div>
    )
})
