import React, { useCallback, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '../common/Button'

/** Props for the base modal */
interface PickerModalBaseProps {
    /** Whether the modal is open */
    isOpen: boolean
    /** Callback to close the modal */
    onClose: () => void
    /** Modal title */
    title: string
    /** Unique ID for aria-labelledby */
    titleId: string
    /** Content to render in the scrollable area */
    children: React.ReactNode
    /** Content for the search area */
    searchContent?: React.ReactNode
    /** Callback for confirm button */
    onConfirm: () => void
    /** Callback for clear/reset button */
    onClear: () => void
    /** Whether the confirm button should be disabled */
    confirmDisabled?: boolean
}

/**
 * Reusable base modal component for picker dialogs.
 * Handles backdrop, keyboard events, focus trapping, and accessibility.
 * Uses React Portal to render at document root, avoiding z-index issues.
 */
export function PickerModalBase({
    isOpen,
    onClose,
    title,
    titleId,
    children,
    searchContent,
    onConfirm,
    onClear,
    confirmDisabled = false,
}: PickerModalBaseProps) {
    const modalRef = useRef<HTMLDivElement>(null)

    // Check if we're on the client (for SSR safety with portals)
    // This is a simple, lint-friendly alternative to useState in useEffect
    const isClient = typeof window !== 'undefined'

    // Handle ESC key to close modal
    useEffect(() => {
        if (!isOpen) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault()
                onClose()
            }

            // Focus trap
            if (e.key === 'Tab' && modalRef.current) {
                const focusables = modalRef.current.querySelectorAll<HTMLElement>(
                    'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
                )
                const first = focusables[0]
                const last = focusables[focusables.length - 1]

                if (e.shiftKey) {
                    if (document.activeElement === first) {
                        last.focus()
                        e.preventDefault()
                    }
                } else {
                    if (document.activeElement === last) {
                        first.focus()
                        e.preventDefault()
                    }
                }
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            const originalOverflow = document.body.style.overflow
            document.body.style.overflow = 'hidden'
            return () => {
                document.body.style.overflow = originalOverflow
            }
        }
    }, [isOpen])

    // Focus first focusable element when modal opens
    useEffect(() => {
        if (isOpen && modalRef.current) {
            // Small timeout to ensure DOM is ready after portal render
            const timer = setTimeout(() => {
                const focusable = modalRef.current?.querySelector<HTMLElement>(
                    'input, button, [tabindex]:not([tabindex="-1"])'
                )
                focusable?.focus()
            }, 50)
            return () => clearTimeout(timer)
        }
    }, [isOpen])

    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        // Only close if clicking the backdrop itself, not children
        if (e.target === e.currentTarget) {
            onClose()
        }
    }, [onClose])

    // Early return - don't render anything if closed or on server
    if (!isOpen || !isClient) return null

    // Render via Portal to document.body
    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={handleBackdropClick}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                aria-hidden="true"
            />

            {/* Modal */}
            <div
                ref={modalRef}
                className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
                onClick={(e) => e.stopPropagation()} // Prevent clicks inside modal from closing it
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
                    <h2 id={titleId} className="text-lg font-semibold text-gray-900">
                        {title}
                    </h2>
                    <button
                        onClick={onClose}
                        type="button"
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label="Lukk"
                    >
                        <X className="h-5 w-5 text-gray-500" aria-hidden="true" />
                    </button>
                </div>

                {/* Search (optional) */}
                {searchContent && (
                    <div className="p-4 border-b border-gray-100 flex-shrink-0">
                        {searchContent}
                    </div>
                )}

                {/* Content - scrollable */}
                <div className="flex-1 overflow-y-auto p-2 min-h-0">
                    {children}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl flex-shrink-0">
                    <Button
                        onClick={onClear}
                        variant="ghost"
                        className="text-gray-600 hover:text-gray-800"
                    >
                        Nullstill
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            onClick={onClose}
                            variant="outline"
                        >
                            Avbryt
                        </Button>
                        <Button
                            onClick={onConfirm}
                            variant="primary"
                            disabled={confirmDisabled}
                        >
                            Bekreft
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
