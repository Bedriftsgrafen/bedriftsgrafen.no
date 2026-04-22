import { memo } from 'react'
import { BarChart, Bar, ResponsiveContainer } from 'recharts'
import type { SparklinePoint } from '../../types/person'

interface PersonRoleSparklineProps {
    dataPoints: SparklinePoint[]
}

/**
 * Mini inline bar chart showing revenue trend for a company.
 * Green bars for positive aarsresultat, red for negative.
 */
export const PersonRoleSparkline = memo(function PersonRoleSparkline({
    dataPoints,
}: PersonRoleSparklineProps) {
    if (dataPoints.length === 0) return null

    const chartData = dataPoints.map((dp) => ({
        year: dp.aar,
        value: dp.salgsinntekter ?? 0,
        fill: dp.aarsresultat !== null && dp.aarsresultat < 0 ? '#ef4444' : '#22c55e',
    }))

    return (
        <div className="inline-flex items-center" title="Omsetningstrend">
            <ResponsiveContainer width={80} height={28}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Bar dataKey="value" radius={[1, 1, 0, 0]} fillOpacity={0.7} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
})
