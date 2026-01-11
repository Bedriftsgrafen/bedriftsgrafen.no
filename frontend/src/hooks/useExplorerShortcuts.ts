import { useEffect, useCallback } from 'react'
import { useExplorerStore } from '../store/explorerStore'

/**
 * Explorer-specific keyboard shortcuts.
 * 
 * Shortcuts:
 * - L: Switch to list view
 * - K: Switch to card view
 * - E: Focus export button (Ctrl+E handled elsewhere)
 */
export function useExplorerShortcuts(onExport?: () => void) {
    const setViewMode = useExplorerStore((s) => s.setViewMode)

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            // Ignore if typing in input/textarea/contenteditable
            const target = event.target as HTMLElement
            if (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.isContentEditable
            ) {
                return
            }

            // L = List view
            if (event.key === 'l' || event.key === 'L') {
                event.preventDefault()
                setViewMode('list')
                return
            }

            // K = Card view
            if (event.key === 'k' || event.key === 'K') {
                event.preventDefault()
                setViewMode('cards')
                return
            }

            // E = Export (without Ctrl)
            if ((event.key === 'e' || event.key === 'E') && !event.ctrlKey && onExport) {
                event.preventDefault()
                onExport()
                return
            }
        },
        [setViewMode, onExport]
    )

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [handleKeyDown])
}
