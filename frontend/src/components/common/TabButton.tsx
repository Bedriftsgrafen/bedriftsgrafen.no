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
    red: 'bg-red-100 text-red-700',
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
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
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${active
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
        >
            {icon}
            {label}
            {badge !== undefined && badge > 0 && (
                <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${BADGE_COLORS[badgeColor]}`}>
                    {formatNumber(badge)}
                </span>
            )}
        </button>
    )
})
