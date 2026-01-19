/**
 * AffiliateBanner component for displaying contextual affiliate promotions
 * Designed to look like a helpful tip rather than a traditional ad
 * Includes "Annonse" label for Norwegian marketing law compliance
 */

import { memo, useCallback, type MouseEvent } from 'react'
import { LucideIcon, ExternalLink, Lightbulb } from 'lucide-react'
import { trackAffiliateClick } from '../../utils/analytics'

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
    variant: BannerVariant
    /** If true, shows as a placeholder banner */
    isPlaceholder?: boolean
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
        background: 'bg-white',
        border: 'border-blue-200',
        iconBg: 'bg-blue-50',
        iconColor: 'text-blue-600',
        buttonBg: 'bg-blue-600',
        buttonHover: 'hover:bg-blue-700',
        accent: 'text-blue-700',
    },
    banking: {
        background: 'bg-white',
        border: 'border-emerald-200',
        iconBg: 'bg-emerald-50',
        iconColor: 'text-emerald-600',
        buttonBg: 'bg-emerald-600',
        buttonHover: 'hover:bg-emerald-700',
        accent: 'text-emerald-700',
    },
    general: {
        background: 'bg-white',
        border: 'border-gray-200',
        iconBg: 'bg-gray-100',
        iconColor: 'text-gray-600',
        buttonBg: 'bg-blue-600',
        buttonHover: 'hover:bg-blue-700',
        accent: 'text-gray-900',
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
    variant,
    isPlaceholder = false,
}: AffiliateBannerProps) {
    const styles = VARIANT_STYLES[variant]

    const handleClick = useCallback((e: MouseEvent<HTMLAnchorElement>) => {
        // Track the click
        trackAffiliateClick(bannerId, variant, placement)

        // If placeholder and no link, prevent navigation
        if (isPlaceholder && link === '#') {
            e.preventDefault()
        }
    }, [bannerId, variant, placement, isPlaceholder, link])

    const isInteractive = link !== '#'

    return (
        <div
            className={`relative rounded-lg border p-4 ${styles.background} ${styles.border}`}
        >
            {/* Disclosure label - Norwegian marketing law compliance */}
            <span className="absolute top-2 right-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                Annonse
            </span>

            <div className="flex items-start gap-4">
                {/* Icon or Logo */}
                <div
                    className={`shrink-0 flex items-center justify-center overflow-hidden rounded-lg ${styles.iconBg} ${logo ? 'w-12 h-12 p-0' : 'p-2'}`}
                >
                    {logo ? (
                        <img
                            src={logo}
                            alt=""
                            className="w-full h-full object-contain"
                        />
                    ) : (
                        <Icon className={`h-5 w-5 ${styles.iconColor}`} />
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <h4 className={`font-semibold ${styles.accent} mb-1`}>
                        {title}
                    </h4>
                    <p className="text-sm text-gray-600 mb-3">
                        {description}
                    </p>

                    {/* CTA Button */}
                    <a
                        href={link}
                        target={isInteractive && !link.startsWith('mailto:') ? '_blank' : undefined}
                        rel={isInteractive ? 'noopener noreferrer sponsored' : undefined}
                        onClick={handleClick}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${styles.buttonBg} ${styles.buttonHover} ${!isInteractive ? 'cursor-default opacity-75' : ''}`}
                    >
                        {buttonText}
                        {isInteractive && !link.startsWith('mailto:') && <ExternalLink className="h-3.5 w-3.5" />}
                    </a>
                </div>
            </div>
        </div>
    )
})
