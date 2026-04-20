import { memo, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'
import type { GenerationCount } from '../../types/person'

const GENERATION_COLORS: Record<string, string> = {
    'Gen Z': '#8b5cf6',
    'Millennials': '#3b82f6',
    'Gen X': '#10b981',
    'Boomers': '#f59e0b',
    'Silent': '#6b7280',
}

interface PersonGenerationChartProps {
    data: GenerationCount[]
}

export const PersonGenerationChart = memo(function PersonGenerationChart({ data }: PersonGenerationChartProps) {
    const chartData = useMemo(
        () => data.map(g => ({
            name: `${g.generation} (${g.birth_year_range})`,
            value: g.count,
            color: GENERATION_COLORS[g.generation] || '#94a3b8',
        })),
        [data]
    )

    if (chartData.length === 0) return null

    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Generasjonsfordeling</h3>
            <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                    >
                        {chartData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip formatter={(value) => Number(value).toLocaleString('nb-NO')} />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
        </div>
    )
})
