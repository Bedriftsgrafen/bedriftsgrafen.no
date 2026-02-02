/**
 * Simple analytics utility for tracking custom events
 * Currently stores events locally - integrate with your preferred analytics provider
 */

import { analyticsService } from '../services/AnalyticsService'

// Analytics event types
export interface AnalyticsEvent {
    event: string
    category: string
    label?: string
    value?: number
    timestamp: string
    metadata?: Record<string, string | number | boolean>
}

/**
 * Track a custom event
 */
export const trackEvent = (
    event: string,
    category: string,
    label?: string,
    value?: number,
    metadata?: Record<string, string | number | boolean>
) => {
    analyticsService.track({
        event,
        category,
        label,
        value,
        metadata
    })
}

/**
 * Track an affiliate banner click
 */
export function trackAffiliateClick(
    bannerId: string,
    variant: string,
    placement: string
): void {
    trackEvent('affiliate_click', 'monetization', bannerId, undefined, {
        variant,
        placement,
    })
}

/**
 * Get stored analytics events (for debugging/export)
 */
export function getStoredEvents(): AnalyticsEvent[] {
    return analyticsService.getHistory()
}

/**
 * Clear stored analytics events
 */
export function clearStoredEvents(): void {
    analyticsService.clearHistory()
}