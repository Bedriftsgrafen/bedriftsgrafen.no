import React, { useCallback, useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    children: React.ReactNode
    width?: string
    maxWidth?: string
    padding?: boolean
    ariaLabel?: string
    ariaLabelledBy?: string
    ariaDescribedBy?: string
}

function restoreScrollPosition(scrollY: number) {
    const root = document.documentElement
    const originalScrollBehavior = root.style.scrollBehavior

    root.style.scrollBehavior = 'auto'
    window.scrollTo(0, scrollY)
    root.style.scrollBehavior = originalScrollBehavior
}

export function Modal({
    isOpen,
    onClose,
    title,
    children,
    width = 'w-full',
    maxWidth = 'max-w-4xl',
    padding = true,
    ariaLabel,
    ariaLabelledBy,
    ariaDescribedBy,
}: ModalProps) {
    const generatedTitleId = useId()
    const dialogRef = useRef<HTMLDivElement>(null)
    const closeButtonRef = useRef<HTMLButtonElement>(null)
    const previousActiveElementRef = useRef<HTMLElement | null>(null)

    useBodyScrollLock(isOpen)

    const resolvedTitleId = ariaLabelledBy ?? (title ? generatedTitleId : undefined)

    const preserveScrollAndClose = useCallback(() => {
        const lockedTop = document.body.style.top
        const lockedScrollY = lockedTop.startsWith('-')
            ? Math.abs(Number.parseInt(lockedTop, 10))
            : window.scrollY

        onClose()

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                restoreScrollPosition(lockedScrollY)
            })
        })
    }, [onClose])

    const handleOverlayMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget) return

        event.preventDefault()
        preserveScrollAndClose()
    }

    useEffect(() => {
        if (!isOpen) return

        previousActiveElementRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                preserveScrollAndClose()
                return
            }

            if (event.key !== 'Tab' || !dialogRef.current) return

            const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
            )

            if (focusableElements.length === 0) return

            const firstFocusable = focusableElements[0]
            const lastFocusable = focusableElements[focusableElements.length - 1]

            if (event.shiftKey && document.activeElement === firstFocusable) {
                event.preventDefault()
                lastFocusable.focus()
                return
            }

            if (!event.shiftKey && document.activeElement === lastFocusable) {
                event.preventDefault()
                firstFocusable.focus()
            }
        }

        document.addEventListener('keydown', handleKeyDown)

        closeButtonRef.current?.focus()

        return () => {
            document.removeEventListener('keydown', handleKeyDown)

            if (previousActiveElementRef.current && document.contains(previousActiveElementRef.current)) {
                previousActiveElementRef.current.focus()
            }
        }
    }, [isOpen, preserveScrollAndClose])

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 bg-black/50 z-2000 flex items-start justify-center p-2 sm:p-4 overflow-y-auto overflow-x-hidden pt-4 sm:pt-10"
            onMouseDown={handleOverlayMouseDown}
        >
            <div
                ref={dialogRef}
                className={`relative bg-white rounded-lg sm:rounded-xl shadow-2xl ${width} ${maxWidth} flex flex-col my-auto overflow-hidden`}
                role="dialog"
                aria-modal="true"
                aria-label={resolvedTitleId ? undefined : ariaLabel}
                aria-labelledby={resolvedTitleId}
                aria-describedby={ariaDescribedBy}
                tabIndex={-1}
            >
                {/* Close button */}
                <button
                    ref={closeButtonRef}
                    onClick={preserveScrollAndClose}
                    className="absolute right-2 top-2 sm:right-4 sm:top-4 p-3 sm:p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors z-10"
                    aria-label="Lukk"
                >
                    <X className="w-5 h-5" aria-hidden="true" />
                </button>

                {title && (
                    <div className="px-4 sm:px-6 py-4 border-b border-gray-200 pr-14 sm:pr-12">
                        <h2 id={generatedTitleId} className="text-lg sm:text-xl font-bold text-gray-900">{title}</h2>
                    </div>
                )}

                <div className={padding ? 'p-4 sm:p-6' : ''}>
                    {children}
                </div>
            </div>
        </div>
    )
}
