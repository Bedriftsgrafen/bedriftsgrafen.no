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
    blue: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
    red: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-200',
    orange: 'bg-orange-50 text-orange-800 dark:bg-orange-500/15 dark:text-orange-200',
    green: 'bg-green-50 text-green-700 dark:bg-emerald-500/15 dark:text-emerald-200',
    purple: 'bg-purple-50 text-purple-700 dark:bg-violet-500/15 dark:text-violet-200',
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
        <div className={`group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700 dark:hover:shadow-black/30 ${className}`}>
            <div className={`shrink-0 p-2.5 rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-110 ${COLOR_CLASSES[color]}`}>
                {icon}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">{label}</p>
                {loading ? (
                    <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />
                ) : (
                    <div className="flex items-center">
                        {children || <p className="truncate text-2xl font-black tracking-tight text-slate-900 dark:text-white">{value}</p>}
                    </div>
                )}
            </div>
        </div>
    )
})
