import { useState, useEffect } from 'react'
import { trackEvent } from './analytics'

/**
 * Hook to run a simple A/B test
 * Assigns the user to a variant and persists it in localStorage
 */
export function useABTest(experimentId: string, variants: string[]): string {
    // Initialize from storage if available
    const [variant, setVariant] = useState<string>(() => {
        const storageKey = `bg_ab_${experimentId}`
        const stored = localStorage.getItem(storageKey)
        if (stored && variants.includes(stored)) return stored
        return variants[0]
    })

    useEffect(() => {
        const storageKey = `bg_ab_${experimentId}`
        const storedVariant = localStorage.getItem(storageKey)

        // If we already have a valid stored variant, ensure state matches (it should)
        if (storedVariant && variants.includes(storedVariant)) {
            if (variant !== storedVariant) {
                setVariant(storedVariant)
            }
            return
        }

        // Assign new variant
        const randomIndex = Math.floor(Math.random() * variants.length)
        const newVariant = variants[randomIndex]

        localStorage.setItem(storageKey, newVariant)
        setVariant(newVariant)

        // Track assignment
        trackEvent('ab_test_assignment', 'experiment', experimentId, undefined, {
            variant: newVariant
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [experimentId]) // Only re-run if experiment ID changes

    return variant
}
