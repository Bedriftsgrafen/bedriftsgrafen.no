import { useState, type MouseEvent, type ReactNode } from 'react'
import { BedriftsgrafenContactModal, type BedriftsgrafenContactContext, type BedriftsgrafenContactIntent } from './BedriftsgrafenContactModal'

interface BedriftsgrafenContactLinkProps {
    children: ReactNode
    className?: string
    intent?: BedriftsgrafenContactIntent
    context?: BedriftsgrafenContactContext
    requiresConfirmation?: boolean
    onClick?: () => void
}

function getInferredContactContext(): BedriftsgrafenContactContext {
    if (typeof window === 'undefined') return 'general'
    if (/^\/(virksomhet|bedrift)\//.test(window.location.pathname)) return 'company'
    if (/^\/person\/[^/]+\/[^/]+/.test(window.location.pathname)) return 'person'
    return 'general'
}

export function BedriftsgrafenContactLink({
    children,
    className,
    intent = 'general',
    context,
    requiresConfirmation,
    onClick,
}: BedriftsgrafenContactLinkProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [activeContext, setActiveContext] = useState<BedriftsgrafenContactContext>(context ?? 'general')
    const contactContext = context ?? activeContext
    const shouldRequireConfirmation = requiresConfirmation ?? contactContext !== 'general'

    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault()
        onClick?.()
        setActiveContext(context ?? getInferredContactContext())
        setIsOpen(true)
    }

    return (
        <>
            <button type="button" className={className} onClick={handleClick}>
                {children}
            </button>
            {isOpen && (
                <BedriftsgrafenContactModal
                    isOpen
                    onClose={() => setIsOpen(false)}
                    intent={intent}
                    context={contactContext}
                    requiresConfirmation={shouldRequireConfirmation}
                />
            )}
        </>
    )
}