import { useState, useEffect } from 'react'
import { trackEvent } from './analytics'

/**
 * Hook to run a simple A/B test
 * Assigns the user to a variant and persists it in localStorage
 */
export function useABTest(experimentId: string, variants: string[]): string {
    // Initialize variant: get from storage or assign new one immediately
    const [variant] = useState<string>(() => {
        const storageKey = `bg_ab_${experimentId}`
        const stored = localStorage.getItem(storageKey)
        if (stored && variants.includes(stored)) return stored

        // Assign new variant if none exists
        const randomIndex = Math.floor(Math.random() * variants.length)
        const newVariant = variants[randomIndex]
        localStorage.setItem(storageKey, newVariant)
        return newVariant
    })

    useEffect(() => {
        // Track assignment once (on mount or if variant/experiment changes)
        trackEvent('ab_test_assignment', 'experiment', experimentId, undefined, {
            variant: variant
        })
    }, [experimentId, variant])

    return variant
}
