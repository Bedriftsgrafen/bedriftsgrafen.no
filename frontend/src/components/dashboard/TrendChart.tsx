import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import { useTrendQuery } from '../../hooks/queries/useTrendQuery'
import { formatNumber } from '../../utils/formatters';
import { formatMonth } from '../../utils/dates';

interface TrendChartProps {
    metric: 'bankruptcies' | 'new_companies'
    title: string
    color: string
    months?: number
}

// formatMonth imported from ../../utils/dates

export function TrendChart({ metric, title, color, months = 12 }: TrendChartProps) {
    const { data, isLoading, isError } = useTrendQuery(metric, months)

    // Calculate trend (compare last month to average)
    const trend = useMemo(() => {
        if (!data || data.length < 2) return null
        const lastMonth = data[data.length - 1]?.count || 0
        const average = data.reduce((sum, d) => sum + d.count, 0) / data.length
        const percentChange = average > 0 ? ((lastMonth - average) / average) * 100 : 0
        return {
            direction: percentChange > 0 ? 'up' : 'down',
            percent: Math.abs(percentChange).toFixed(0)
        }
    }, [data])

    // Transform data for chart
    const chartData = useMemo(() => {
        if (!data) return []
        return data.map(d => ({
            month: formatMonth(d.month),
            count: d.count
        }))
    }, [data])

    if (isLoading) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="h-64 bg-gray-100 animate-pulse rounded" />
            </div>
        )
    }

    if (isError) {
        return (
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center justify-center h-64 text-gray-500">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    Kunne ikke laste data
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">{title}</h2>
                {trend && (
                    <div className={`flex items-center text-sm ${trend.direction === 'up' ? 'text-red-700' : 'text-green-700'}`}>
                        {trend.direction === 'up' ? (
                            <TrendingUp className="h-4 w-4 mr-1" />
                        ) : (
                            <TrendingDown className="h-4 w-4 mr-1" />
                        )}
                        {trend.percent}% vs snitt
                    </div>
                )}
            </div>

            <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={{ stroke: '#e5e7eb' }}
                        width={40}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'white',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                        }}
                        formatter={(value) => [typeof value === 'number' ? formatNumber(value) : '0', 'Antall']}
                    />
                    <Area
                        type="monotone"
                        dataKey="count"
                        stroke={color}
                        strokeWidth={2}
                        fill={color}
                        fillOpacity={0.1}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}
