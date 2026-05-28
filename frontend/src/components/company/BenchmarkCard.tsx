import React, { memo } from 'react'
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
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

function formatPercentileLabel(percentile: number | null): string | null {
    if (percentile === null) return null
    if (percentile >= 50) return `Topp ${Math.max(1, 100 - percentile)}%`
    return `Bunn ${Math.max(1, percentile)}%`
}

function calculateRelativeDifference(metric: BenchmarkMetric): number | null {
    if (metric.company_value === null || metric.industry_avg === null) return null
    if (metric.industry_avg === 0) return metric.company_value === 0 ? 0 : null
    return ((metric.company_value - metric.industry_avg) / Math.abs(metric.industry_avg)) * 100
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
    companyName = 'Din virksomhet'
}: BenchmarkCardProps) {
    const displayName = truncateName(companyName)

    // Memoize data to ensure stable reference for Recharts
    const data = React.useMemo(() => [
        { name: displayName, value: metric.company_value, fill: '#2563eb' },
        { name: 'Bransjesnitt', value: metric.industry_avg, fill: '#94a3b8' }
    ], [displayName, metric.company_value, metric.industry_avg])

    if (metric.industry_avg === null) return null

    const percentileLabel = formatPercentileLabel(metric.percentile)
    const diffPercent = calculateRelativeDifference(metric)
    const percentileTone = metric.percentile !== null && metric.percentile >= 50

    const diffColor = diffPercent === null || diffPercent === 0
        ? 'text-gray-500'
        : diffPercent > 0
            ? 'text-green-600'
            : 'text-red-600'

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
                            {percentileLabel && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${percentileTone
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                    }`}>
                                    {percentileLabel}
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
                            formatter={(value) => [
                                typeof value === 'number' ? formatter(value) : '',
                                title
                            ]}
                            cursor={{ fill: 'transparent' }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-2 text-xs text-center text-gray-500">
                {diffPercent !== null && (
                    <>
                        <span className={`font-medium ${diffColor}`}>
                            {diffPercent > 0 ? '+' : ''}{diffPercent.toFixed(1)}%
                        </span>
                        {' '}
                    </>
                )}
                {' '}vs bransjesnitt ({formatter(metric.industry_avg)})
            </div>
        </div>
    )
})
