import React, { useRef, useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title?: string
    children: React.ReactNode
    width?: string
    maxWidth?: string
    padding?: boolean
}

export function Modal({
    isOpen,
    onClose,
    title,
    children,
    width = 'w-full',
    maxWidth = 'max-w-4xl',
    padding = true
}: ModalProps) {
    const modalRef = useRef<HTMLDivElement>(null)

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose()
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            const originalOverflow = document.body.style.overflow
            document.body.style.overflow = 'hidden'

            return () => {
                document.removeEventListener('mousedown', handleClickOutside)
                document.body.style.overflow = originalOverflow
            }
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 z-2000 flex items-start justify-center p-2 sm:p-4 overflow-y-auto pt-4 sm:pt-10">
            <div
                ref={modalRef}
                className={`relative bg-white rounded-lg sm:rounded-xl shadow-2xl ${width} ${maxWidth} flex flex-col my-auto`}
                role="dialog"
                aria-modal="true"
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute right-2 top-2 sm:right-4 sm:top-4 p-3 sm:p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors z-10"
                    aria-label="Lukk"
                >
                    <X className="w-5 h-5" />
                </button>

                {title && (
                    <div className="px-4 sm:px-6 py-4 border-b border-gray-200 pr-14 sm:pr-12">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-900">{title}</h2>
                    </div>
                )}

                <div className={padding ? 'p-4 sm:p-6' : ''}>
                    {children}
                </div>
            </div>
        </div>
    )
}
