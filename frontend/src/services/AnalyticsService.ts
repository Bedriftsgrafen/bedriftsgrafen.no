import { AnalyticsEvent } from '../utils/analytics'
import { logger } from '../utils/logger'

/**
 * Service for handling application-wide analytics
 * Follows the Service pattern for modularity and testability
 */
export class AnalyticsService {
    private static instance: AnalyticsService
    private storageKey = 'bedriftsgrafen_analytics'
    private maxEvents = 1000

    private constructor() { }

    public static getInstance(): AnalyticsService {
        if (!AnalyticsService.instance) {
            AnalyticsService.instance = new AnalyticsService()
        }
        return AnalyticsService.instance
    }

    /**
     * Track an event across all configured providers
     */
    public track(event: Omit<AnalyticsEvent, 'timestamp'>): void {
        const fullEvent: AnalyticsEvent = {
            ...event,
            timestamp: new Date().toISOString()
        }

        this.trackToLocal(fullEvent)
        this.trackToProviders(fullEvent)
    }

    /**
     * Persist event locally for debugging/history
     */
    private trackToLocal(event: AnalyticsEvent): void {
        try {
            const stored = localStorage.getItem(this.storageKey)
            const events: AnalyticsEvent[] = stored ? JSON.parse(stored) : []
            events.unshift(event)

            if (events.length > this.maxEvents) {
                events.pop()
            }

            localStorage.setItem(this.storageKey, JSON.stringify(events))
        } catch (error) {
            // Silently fail if storage is full or unavailable
            logger.warn('[AnalyticsService] Failed to store event locally', error)
        }
    }

    /**
     * Dispatch to external providers (e.g., GA4, Plausible)
     */
    private trackToProviders(event: AnalyticsEvent): void {
        // stub for future integrations
        // Use global Window expansion from global.d.ts
        if (typeof window !== 'undefined' && window.gtag) {
            window.gtag('event', event.event, {
                event_category: event.category,
                event_label: event.label,
                value: event.value,
                ...event.metadata
            })
        }
    }

    /**
     * Retrieve local event history
     */
    public getHistory(): AnalyticsEvent[] {
        try {
            const stored = localStorage.getItem(this.storageKey)
            return stored ? JSON.parse(stored) : []
        } catch {
            return []
        }
    }

    /**
     * Purge local history
     */
    public clearHistory(): void {
        localStorage.removeItem(this.storageKey)
    }
}

export const analyticsService = AnalyticsService.getInstance()
