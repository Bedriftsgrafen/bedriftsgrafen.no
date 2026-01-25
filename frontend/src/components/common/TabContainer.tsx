import React from 'react'

interface TabContainerProps {
    children: React.ReactNode
    className?: string
}

/**
 * Standard container for tab navigation with horizontal scroll on mobile.
 * 
 * DESIGN NOTES:
 * - -mx-4 px-4: Used on small screens to create an "edge-to-edge" scroll effect,
 *   allowing tabs to bleed into the page margins while staying aligned.
 * - no-scrollbar: Custom utility from index.css to hide scrollbars while maintaining functionality.
 */
export function TabContainer({ children, className = '' }: TabContainerProps) {
    return (
        <div className={`flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto whitespace-nowrap no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 ${className}`}>
            {children}
        </div>
    )
}
