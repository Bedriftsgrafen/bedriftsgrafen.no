import { memo, useMemo } from 'react'
import { Building2, Briefcase, TrendingUp, AlertTriangle } from 'lucide-react'
import type { PersonRole } from '../../types/person'
import { formatLargeCurrency } from '../../utils/formatters'

interface PersonSummaryStatsProps {
    roles: PersonRole[]
}

export const PersonSummaryStats = memo(function PersonSummaryStats({ roles }: PersonSummaryStatsProps) {
    const stats = useMemo(() => {
        const activeRoles = roles.filter(r => !r.fratraadt)
        const uniqueOrgnrs = new Set(activeRoles.map(r => r.orgnr))
        const totalRevenue = activeRoles.reduce((sum, r) => sum + (r.latest_salgsinntekter ?? 0), 0)
        const bankruptCount = roles.filter(r => r.konkurs).length

        return {
            activeCount: activeRoles.length,
            companyCount: uniqueOrgnrs.size,
            totalRevenue: totalRevenue > 0 ? totalRevenue : null,
            bankruptCount,
        }
    }, [roles])

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard
                icon={<Briefcase className="h-5 w-5" />}
                label="Aktive roller"
                value={String(stats.activeCount)}
                color="blue"
            />
            <StatCard
                icon={<Building2 className="h-5 w-5" />}
                label="Virksomheter"
                value={String(stats.companyCount)}
                color="indigo"
            />
            {stats.totalRevenue !== null && (
                <StatCard
                    icon={<TrendingUp className="h-5 w-5" />}
                    label="Samlet omsetning"
                    value={formatLargeCurrency(stats.totalRevenue)}
                    color="green"
                />
            )}
            {stats.bankruptCount > 0 && (
                <StatCard
                    icon={<AlertTriangle className="h-5 w-5" />}
                    label="Konkurs"
                    value={String(stats.bankruptCount)}
                    color="red"
                />
            )}
        </div>
    )
})

const COLOR_MAP: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
            <div className={`inline-flex p-2 rounded-lg mb-2 ${COLOR_MAP[color] ?? COLOR_MAP.blue}`}>
                {icon}
            </div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">{label}</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{value}</p>
        </div>
    )
}
