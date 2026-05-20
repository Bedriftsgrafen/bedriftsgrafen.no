import { memo } from 'react'
import { Link } from '@tanstack/react-router'
import { Trophy } from 'lucide-react'
import { formatCategoryValue } from './toplistFormatters'
import { PersonGenerationChart } from './PersonGenerationChart'
import { PersonRoleTypeChart } from './PersonRoleTypeChart'
import type { PersonToplistResponse, PersonAggregateStats, ToplistCategory } from '../../types/person'

const CATEGORY_LABELS: Record<ToplistCategory, string> = {
    salgsinntekter: 'Størst omsetning',
    total_profit: 'Størst overskudd',
    total_employees: 'Flest ansatte',
    DAGL: 'Flest daglig leder',
    active_companies: 'Flest virksomheter',
    industry_diversity: 'Mest bransjemangfold',
    LEDE: 'Flest styreleder',
    MEDL: 'Flest styremedlem',
    active_roles: 'Flest aktive roller',
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
                        className="rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:shadow-black/30"
                    >
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200">
                                <Trophy className="h-4 w-4 text-amber-500" />
                                {CATEGORY_LABELS[list.category]}
                            </h3>
                            <button
                                onClick={() => onTabChange('topplister')}
                                className="text-xs text-blue-600 hover:underline dark:text-blue-300"
                            >
                                Se alle
                            </button>
                        </div>
                        <ol className="space-y-1.5">
                            {list.entries.slice(0, 5).map((entry, i) => (
                                <li key={`${entry.name}-${entry.birth_year}`} className="flex items-center gap-2 text-sm">
                                    <span className="w-5 text-right font-medium text-slate-400 dark:text-slate-500">{i + 1}.</span>
                                    <Link
                                        to="/person/$name/$birthdate"
                                        params={{ name: entry.name, birthdate: String(entry.birth_year ?? '') }}
                                        className="flex-1 truncate text-blue-600 hover:underline dark:text-blue-300"
                                    >
                                        {entry.name}
                                    </Link>
                                    <span className="shrink-0 font-medium tabular-nums text-slate-500 dark:text-slate-400">
                                        {formatCategoryValue(list.category, entry.value)}
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
