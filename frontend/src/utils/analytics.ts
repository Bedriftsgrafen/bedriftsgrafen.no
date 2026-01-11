/**
 * Simple analytics utility for tracking custom events
 * Currently stores events locally - integrate with your preferred analytics provider
 */

// Analytics event types
export interface AnalyticsEvent {
    event: string
    category: string
    label?: string
    value?: number
    timestamp: string
    metadata?: Record<string, string | number | boolean>
}

// Store events in localStorage for debugging/dev history
// Primary tracking is handled via Google Analytics (see trackEvent)
const STORAGE_KEY = 'bedriftsgrafen_analytics'
const MAX_EVENTS = 1000 // Limit stored events

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
    // Construct the event object
    const analyticsEvent: AnalyticsEvent = {
        event,
        category,
        label,
        value,
        metadata,
        timestamp: new Date().toISOString()
    }

    // TODO: Implement analytics service integration (e.g., Google Analytics, Plausible)
    // console.log('[Analytics]', analyticsEvent)

    // Optional: Store in local storage for debugging (implementing usage of MAX_EVENTS)
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        const events: AnalyticsEvent[] = stored ? JSON.parse(stored) : []
        events.unshift(analyticsEvent)
        if (events.length > MAX_EVENTS) {
            events.pop()
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
    } catch {
        // Ignore storage errors
    }
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
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        return stored ? JSON.parse(stored) : []
    } catch {
        return []
    }
}

/**
 * Clear stored analytics events
 */
export function clearStoredEvents(): void {
    localStorage.removeItem(STORAGE_KEY)
}