import { memo } from 'react'
import { Users, Briefcase, Calendar } from 'lucide-react'
import { SummaryCard } from '../common/SummaryCard'
import { formatNumber } from '../../utils/formatters'
import type { PersonAggregateStats } from '../../types/person'

interface PersonLandingHeroProps {
    stats: PersonAggregateStats | undefined
    loading: boolean
}

export const PersonLandingHero = memo(function PersonLandingHero({ stats, loading }: PersonLandingHeroProps) {
    return (
        <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Personer
            </h1>
            <p className="text-slate-600 mb-6">
                Utforsk {stats ? formatNumber(stats.total_persons) : '...'} personer med roller i norsk næringsliv
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCard
                    icon={<Users className="h-5 w-5" />}
                    label="Unike personer"
                    value={stats ? formatNumber(stats.total_persons) : undefined}
                    color="blue"
                    loading={loading}
                />
                <SummaryCard
                    icon={<Briefcase className="h-5 w-5" />}
                    label="Aktive roller"
                    value={stats ? formatNumber(stats.total_active_roles) : undefined}
                    color="green"
                    loading={loading}
                />
                <SummaryCard
                    icon={<Calendar className="h-5 w-5" />}
                    label="Snittalder styremedlemmer"
                    value={stats ? `${stats.avg_board_age} år` : undefined}
                    color="purple"
                    loading={loading}
                />
            </div>
        </div>
    )
})
