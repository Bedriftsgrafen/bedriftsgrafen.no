/**
 * Global type definitions for Bedriftsgrafen.no frontend
 */

interface Window {
    /**
     * Google Analytics / Gtag analytics function
     */
    gtag?: (
        command: 'config' | 'event' | 'js' | 'set',
        targetIdOrEventName: string,
        additionalConfigInfo?: Record<string, unknown>
    ) => void;
}
