/**
 * Tab button component for navigation tabs
 * Memoized for performance
 */

import React, { memo } from 'react'
import { formatNumber } from '../../utils/formatters'

interface TabButtonProps {
    active: boolean
    icon: React.ReactNode
    label: string
    onClick: () => void
    badge?: number
    badgeColor?: 'red' | 'green' | 'blue'
}

const BADGE_COLORS = {
    red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200',
    green: 'bg-green-100 text-green-700 dark:bg-emerald-500/15 dark:text-emerald-200',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200',
}

export const TabButton = memo(function TabButton({
    active,
    icon,
    label,
    onClick,
    badge,
    badgeColor = 'red'
}: TabButtonProps) {
    return (
        <button
            type="button"
            role="tab"
            aria-selected={active}
            onClick={onClick}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${active
                    ? 'border-b-2 border-blue-900 text-blue-900 dark:border-blue-300 dark:text-blue-200'
                    : 'text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
        >
            <span aria-hidden="true">{icon}</span>
            {label}
            {badge !== undefined && badge > 0 && (
                <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${BADGE_COLORS[badgeColor]}`}>
                    {formatNumber(badge)}
                </span>
            )}
        </button>
    )
})
