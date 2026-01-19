/**
 * Summary card component for dashboard statistics
 * Memoized for performance
 */

import React, { memo } from 'react'

type CardColor = 'blue' | 'red' | 'orange' | 'green' | 'purple'

interface SummaryCardProps {
    icon: React.ReactNode
    label: string
    value?: string
    color?: CardColor
    loading?: boolean
    children?: React.ReactNode
    className?: string
}

const COLOR_CLASSES: Record<CardColor, string> = {
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-700',
    orange: 'bg-orange-50 text-orange-800',
    green: 'bg-green-50 text-green-700',
    purple: 'bg-purple-50 text-purple-700',
}

export const SummaryCard = memo(function SummaryCard({
    icon,
    label,
    value,
    color = 'blue',
    loading = false,
    children,
    className = ''
}: SummaryCardProps) {
    return (
        <div className={`bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 transition-all duration-200 hover:border-slate-300 shadow-sm ${className}`}>
            <div className={`shrink-0 p-2.5 rounded-xl shadow-sm ${COLOR_CLASSES[color]}`}>
                {icon}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">{label}</p>
                {loading ? (
                    <div className="h-8 w-24 bg-slate-100 animate-pulse rounded-lg" />
                ) : (
                    <div className="flex items-center">
                        {children || <p className="text-2xl font-black text-slate-900 truncate tracking-tight">{value}</p>}
                    </div>
                )}
            </div>
        </div>
    )
})
