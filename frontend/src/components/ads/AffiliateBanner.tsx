/**
 * AffiliateBanner component for displaying contextual affiliate promotions
 * Designed to look like a helpful tip rather than a traditional ad
 * Includes "Annonse" label for Norwegian marketing law compliance
 */

import { memo, useCallback, type MouseEvent } from 'react'
import { LucideIcon, ExternalLink, Lightbulb } from 'lucide-react'
import { trackAffiliateClick } from '../../utils/analytics'
import { isBedriftsgrafenContactHref } from '../../constants/contact'
import { BedriftsgrafenContactLink, type BedriftsgrafenContactContext, type BedriftsgrafenContactIntent } from '../contact'

type BannerVariant = 'accounting' | 'banking' | 'general'

interface AffiliateBannerProps {
    /** Unique identifier for this banner (used for analytics) */
    bannerId: string
    /** Where this banner is placed (e.g., 'overview_tab', 'financials_tab') */
    placement: string
    title: string
    description: string
    buttonText: string
    /** Set to '#' for placeholder banners */
    link: string
    icon?: LucideIcon
    logo?: string
    logoWidth?: number
    logoHeight?: number
    variant: BannerVariant
    legalText?: string
    legalTextMode?: 'none' | 'inline'
    /** If true, shows as a placeholder banner */
    isPlaceholder?: boolean
    contactIntent?: BedriftsgrafenContactIntent
    contactContext?: BedriftsgrafenContactContext
    requiresContactConfirmation?: boolean
}

const VARIANT_STYLES: Record<BannerVariant, {
    background: string
    border: string
    iconBg: string
    iconColor: string
    buttonBg: string
    buttonHover: string
    accent: string
}> = {
    accounting: {
        background: 'bg-white dark:bg-slate-900',
        border: 'border-blue-200 dark:border-blue-400/20',
        iconBg: 'bg-blue-50 dark:bg-blue-500/15',
        iconColor: 'text-blue-600 dark:text-blue-200',
        buttonBg: 'bg-blue-900 dark:bg-blue-500 dark:text-slate-950',
        buttonHover: 'hover:bg-blue-800 dark:hover:bg-blue-400',
        accent: 'text-gray-900 dark:text-white',
    },
    banking: {
        background: 'bg-white dark:bg-slate-900',
        border: 'border-emerald-200 dark:border-emerald-400/20',
        iconBg: 'bg-emerald-50 dark:bg-emerald-500/15',
        iconColor: 'text-emerald-600 dark:text-emerald-200',
        buttonBg: 'bg-blue-900 dark:bg-blue-500 dark:text-slate-950',
        buttonHover: 'hover:bg-blue-800 dark:hover:bg-blue-400',
        accent: 'text-gray-900 dark:text-white',
    },
    general: {
        background: 'bg-white dark:bg-slate-900',
        border: 'border-gray-200 dark:border-slate-800',
        iconBg: 'bg-gray-100 dark:bg-slate-800',
        iconColor: 'text-gray-600 dark:text-slate-300',
        buttonBg: 'bg-blue-900 dark:bg-blue-500 dark:text-slate-950',
        buttonHover: 'hover:bg-blue-800 dark:hover:bg-blue-400',
        accent: 'text-gray-900 dark:text-white',
    },
}

export const AffiliateBanner = memo(function AffiliateBanner({
    bannerId,
    placement,
    title,
    description,
    buttonText,
    link,
    icon: Icon = Lightbulb,
    logo,
    logoWidth,
    logoHeight,
    variant,
    legalText,
    legalTextMode = 'none',
    contactIntent = 'partnership',
    contactContext,
    requiresContactConfirmation,
}: AffiliateBannerProps) {
    const styles = VARIANT_STYLES[variant]

    const handleClick = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
        // Track the click
        trackAffiliateClick(bannerId, variant, placement)

        // If placeholder/no link, prevent navigation
        if (link === '#') {
            e.preventDefault()
        }
    }, [bannerId, variant, placement, link])

    const handleContactClick = useCallback(() => {
        trackAffiliateClick(bannerId, variant, placement)
    }, [bannerId, variant, placement])

    const isInteractive = link !== '#'
    const isBedriftsgrafenContact = isBedriftsgrafenContactHref(link)
    const buttonClassName = `inline-flex w-fit items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${styles.buttonBg} ${styles.buttonHover} ${!isInteractive ? 'cursor-default opacity-75' : ''}`

    return (
        <div
            className={`relative flex h-full rounded-lg border p-4 transition-colors duration-300 ${styles.background} ${styles.border}`}
        >
            <div className="flex w-full flex-col">
                {/* Disclosure label - Norwegian marketing law compliance */}
                <div className="mb-2 flex justify-end">
                    <span className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">
                        Annonse
                    </span>
                </div>

                <div className="flex flex-1 items-start gap-4">
                    {/* Icon or Logo */}
                    <div
                        className={`shrink-0 flex items-center justify-center overflow-hidden rounded-lg ${styles.iconBg} ${logo ? 'w-12 h-12 p-0' : 'p-2'}`}
                    >
                        {logo ? (
                            <img
                                src={logo}
                                alt=""
                                width={logoWidth}
                                height={logoHeight}
                                loading="lazy"
                                decoding="async"
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <Icon className={`h-5 w-5 ${styles.iconColor}`} aria-hidden="true" />
                        )}
                    </div>

                    {/* Content */}
                    <div className="flex min-w-0 flex-1 flex-col self-stretch">
                        <div className={`font-semibold ${styles.accent} mb-1 text-lg`}>
                            {title}
                        </div>
                        <p className="mb-3 text-sm text-gray-600 dark:text-slate-300">
                            {description}
                        </p>

                        <div className="mt-auto pt-1">
                            {isBedriftsgrafenContact ? (
                                <BedriftsgrafenContactLink
                                    className={buttonClassName}
                                    intent={contactIntent}
                                    context={contactContext}
                                    requiresConfirmation={requiresContactConfirmation}
                                    onClick={handleContactClick}
                                >
                                    {buttonText}
                                </BedriftsgrafenContactLink>
                            ) : isInteractive ? (
                                <a
                                    href={link}
                                    target={isInteractive && !link.startsWith('mailto:') ? '_blank' : undefined}
                                    rel={isInteractive ? 'noopener noreferrer sponsored' : undefined}
                                    onClick={handleClick}
                                    className={buttonClassName}
                                >
                                    {buttonText}
                                    {isInteractive && !link.startsWith('mailto:') && <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />}
                                </a>
                            ) : (
                                <span className={buttonClassName} aria-disabled="true">
                                    {buttonText}
                                </span>
                            )}
                        </div>

                        {legalText && legalTextMode === 'inline' && (
                            <p className="mt-3 border-t border-gray-100 pt-3 text-xs leading-5 text-gray-500 dark:border-slate-800 dark:text-slate-500">
                                {legalText}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
})
