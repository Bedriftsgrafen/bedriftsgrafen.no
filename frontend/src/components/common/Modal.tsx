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
            // Prevent body scroll
            document.body.style.overflow = 'hidden'
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.body.style.overflow = 'unset'
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/50 z-2000 flex items-start justify-center p-4 overflow-y-auto pt-20">
            <div
                ref={modalRef}
                className={`relative bg-white rounded-xl shadow-2xl ${width} ${maxWidth} flex flex-col my-auto`}
                role="dialog"
                aria-modal="true"
            >
                {/* Close button - simplified without full header if title is missing */}
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors z-10"
                    aria-label="Lukk"
                >
                    <X className="w-5 h-5" />
                </button>

                {title && (
                    <div className="px-6 py-4 border-b border-gray-200 pr-12">
                        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
                    </div>
                )}

                <div className={padding ? 'p-6' : ''}>
                    {children}
                </div>
            </div>
        </div>
    )
}
