/**
 * Summary card component for dashboard statistics
 * Memoized for performance
 */

import React, { memo } from 'react'

type CardColor = 'blue' | 'red' | 'orange' | 'green' | 'purple'

interface SummaryCardProps {
    icon: React.ReactNode
    label: string
    value: string
    color?: CardColor
    loading?: boolean
}

const COLOR_CLASSES: Record<CardColor, string> = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
}

export const SummaryCard = memo(function SummaryCard({
    icon,
    label,
    value,
    color = 'blue',
    loading = false
}: SummaryCardProps) {
    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${COLOR_CLASSES[color]}`}>
                {icon}
            </div>
            <div>
                <p className="text-xs text-gray-500 uppercase font-medium">{label}</p>
                {loading ? (
                    <div className="h-8 w-20 bg-gray-200 animate-pulse rounded" />
                ) : (
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                )}
            </div>
        </div>
    )
})
