import React, { memo } from 'react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts'
import type { BenchmarkMetric } from '../../hooks/queries/useBenchmarkQuery'

interface BenchmarkCardProps {
    title: string
    metric: BenchmarkMetric
    icon: React.ReactNode
    formatter: (val: number | null) => string
    color: string
    companyName?: string
}

/** Truncate string to max length with ellipsis */
function truncateName(name: string, maxLength: number = 12): string {
    if (name.length <= maxLength) return name
    return name.slice(0, maxLength - 1) + '…'
}

/**
 * BenchmarkCard displays a single metric comparison between company and industry.
 *
 * Memoized to prevent re-renders when parent updates unrelated state.
 * Only re-renders when metric, title, or formatter actually changes.
 */
export const BenchmarkCard = memo(function BenchmarkCard({
    title,
    metric,
    icon,
    formatter,
    color,
    companyName = 'Din bedrift'
}: BenchmarkCardProps) {
    const displayName = truncateName(companyName)

    // Memoize data to ensure stable reference for Recharts
    const data = React.useMemo(() => [
        { name: displayName, value: metric.company_value, type: 'company' },
        { name: 'Bransjesnitt', value: metric.industry_avg, type: 'industry' }
    ], [displayName, metric.company_value, metric.industry_avg])

    if (metric.company_value === null || metric.industry_avg === null) return null

    // Calculate how much better/worse than average
    // Handle division by zero if industry average is 0
    let diffPercent = 0
    if (metric.industry_avg !== 0) {
        diffPercent = ((metric.company_value - metric.industry_avg) / Math.abs(metric.industry_avg)) * 100
    }
    
    const isPositive = diffPercent > 0
    const diffColor = isPositive ? 'text-green-600' : 'text-red-600'

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${color} bg-opacity-10`}>
                        {icon}
                    </div>
                    <div>
                        <h4 className="text-sm font-medium text-gray-500">{title}</h4>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-gray-900">
                                {formatter(metric.company_value)}
                            </span>
                            {metric.percentile !== null && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${metric.percentile >= 50
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                    {metric.percentile >= 50
                                        ? `Topp ${100 - metric.percentile}%`
                                        : `Bunn ${metric.percentile}%`
                                    }
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis
                            dataKey="name"
                            type="category"
                            width={80}
                            tick={{ fontSize: 11 }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            formatter={(value: number | undefined) => [
                                value != null ? formatter(value) : '',
                                title
                            ]}
                            cursor={{ fill: 'transparent' }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                            {data.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={entry.type === 'company' ? '#2563eb' : '#94a3b8'}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-2 text-xs text-center text-gray-500">
                <span className={`font-medium ${diffColor}`}>
                    {isPositive ? '+' : ''}{diffPercent.toFixed(1)}%
                </span>
                {' '}vs bransjesnitt ({formatter(metric.industry_avg)})
            </div>
        </div>
    )
})
