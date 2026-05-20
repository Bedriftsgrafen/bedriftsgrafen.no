import React from 'react'

interface TabContainerProps {
    children: React.ReactNode
    className?: string
    ariaLabel?: string
}

/**
 * Standard container for tab navigation with horizontal scroll on mobile.
 * 
 * DESIGN NOTES:
 * - -mx-4 px-4: Used on small screens to create an "edge-to-edge" scroll effect,
 *   allowing tabs to bleed into the page margins while staying aligned.
 * - no-scrollbar: Custom utility from index.css to hide scrollbars while maintaining functionality.
 */
export function TabContainer({ children, className = '', ariaLabel = 'Seksjoner' }: TabContainerProps) {
    return (
        <div
            role="tablist"
            aria-label={ariaLabel}
            className={`no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto whitespace-nowrap border-b border-gray-200 px-4 dark:border-slate-800 sm:mx-0 sm:px-0 ${className}`}
        >
            {children}
        </div>
    )
}
