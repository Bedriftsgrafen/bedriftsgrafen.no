import React, { memo, useMemo } from 'react'
import { Building2, TrendingUp, Users, PiggyBank, RefreshCw } from 'lucide-react'
import { useCompanyStatsQuery } from '../../hooks/queries/useCompanyStatsQuery'
import { useFilterParams } from '../../hooks/useFilterParams'

import { formatLargeNumber } from '../../utils/formatters'

/** Props for individual stat card */
interface StatCardProps {
    label: string
    value: string
    icon: React.ReactNode
    color: string
    isLoading?: boolean
    isError?: boolean
}

/** Individual stat card component */
const StatCard = memo(function StatCard({ label, value, icon, color, isLoading, isError }: StatCardProps) {
    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
                <div className={`flex items-center justify-center h-10 w-10 rounded-lg ${color}`}>
                    {icon}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-xs text-gray-500 truncate">{label}</p>
                    {isLoading ? (
                        <div className="h-6 w-20 bg-gray-200 rounded animate-pulse mt-0.5" />
                    ) : isError ? (
                        <p className="text-lg font-semibold text-red-500">Feil</p>
                    ) : (
                        <p className="text-lg font-semibold text-gray-900 truncate">{value}</p>
                    )}
                </div>
            </div>
        </div>
    )
})

// Pre-created icon elements to avoid recreating on each render
const STAT_ICONS = {
    companies: <Building2 className="h-5 w-5 text-blue-600" aria-hidden="true" />,
    revenue: <TrendingUp className="h-5 w-5 text-green-600" aria-hidden="true" />,
    profit: <PiggyBank className="h-5 w-5 text-purple-600" aria-hidden="true" />,
    employees: <Users className="h-5 w-5 text-orange-600" aria-hidden="true" />,
} as const

/**
 * Statistics cards showing aggregate data for filtered companies.
 * Displays total companies, revenue, profit, and employees.
 */
export const ExplorerStats = memo(function ExplorerStats() {
    const { filterParams, sortBy } = useFilterParams()
    const { data: stats, isLoading, isError, refetch } = useCompanyStatsQuery({
        ...filterParams,
        sort_by: sortBy,
    })

    // Memoize formatted values
    const formattedStats = useMemo(() => {
        if (!stats) return null
        return {
            count: formatLargeNumber(stats.total_count),
            revenue: `${formatLargeNumber(stats.total_revenue)} kr`,
            profit: `${formatLargeNumber(stats.total_profit)} kr`,
            employees: formatLargeNumber(stats.total_employees),
        }
    }, [stats])

    // Early return for error state with retry button
    if (isError && !isLoading) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                    <p className="text-sm text-red-700">Kunne ikke laste statistikk</p>
                    <button
                        type="button"
                        onClick={() => refetch()}
                        className="flex items-center gap-1 text-sm text-red-700 hover:text-red-800"
                    >
                        <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        Prøv igjen
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <StatCard
                label="Antall selskaper"
                value={formattedStats?.count ?? '0'}
                icon={STAT_ICONS.companies}
                color="bg-blue-50"
                isLoading={isLoading}
            />
            <StatCard
                label="Total omsetning"
                value={formattedStats?.revenue ?? '0 kr'}
                icon={STAT_ICONS.revenue}
                color="bg-green-50"
                isLoading={isLoading}
            />
            <StatCard
                label="Total resultat"
                value={formattedStats?.profit ?? '0 kr'}
                icon={STAT_ICONS.profit}
                color="bg-purple-50"
                isLoading={isLoading}
            />
            <StatCard
                label="Total ansatte"
                value={formattedStats?.employees ?? '0'}
                icon={STAT_ICONS.employees}
                color="bg-orange-50"
                isLoading={isLoading}
            />
        </div>
    )
})

