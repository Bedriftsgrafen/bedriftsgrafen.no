import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { PersonRole } from '../../types/person'
import { getNaceSectionName } from '../../constants/naceSections'

interface PersonIndustryChartProps {
    roles: PersonRole[]
}

const COLORS = [
    '#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#ef4444',
    '#10b981', '#f97316', '#6366f1', '#ec4899', '#14b8a6',
]

/**
 * Donut chart showing role distribution by NACE industry sector.
 * Top 5 sectors + "Andre" bucket.
 */
export function PersonIndustryChart({ roles }: PersonIndustryChartProps) {
    const chartData = useMemo(() => {
        const sectorCounts: Record<string, number> = {}
        const activeRoles = roles.filter((r) => !r.fratraadt)

        for (const role of activeRoles) {
            const sectorName = getNaceSectionName(role.naeringskode) ?? 'Ukjent'
            sectorCounts[sectorName] = (sectorCounts[sectorName] || 0) + 1
        }

        const sorted = Object.entries(sectorCounts)
            .map(([name, count]) => ({ name, value: count }))
            .sort((a, b) => b.value - a.value)

        if (sorted.length <= 6) return sorted

        const top5 = sorted.slice(0, 5)
        const otherCount = sorted.slice(5).reduce((sum, s) => sum + s.value, 0)
        return [...top5, { name: 'Andre', value: otherCount }]
    }, [roles])

    if (chartData.length === 0) return null

    return (
        <div className="mt-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Bransjefordeling
            </h3>
            <div className="flex items-center gap-4">
                <div className="w-32 h-32">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={25}
                                outerRadius={50}
                                dataKey="value"
                                stroke="none"
                            >
                                {chartData.map((_, i) => (
                                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value) => [`${value} roller`, '']}
                                contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5">
                    {chartData.map((item, i) => (
                        <div key={item.name} className="flex items-center gap-2 text-sm">
                            <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: COLORS[i % COLORS.length] }}
                            />
                            <span className="text-gray-700 truncate">{item.name}</span>
                            <span className="text-gray-400 ml-auto">{item.value}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
