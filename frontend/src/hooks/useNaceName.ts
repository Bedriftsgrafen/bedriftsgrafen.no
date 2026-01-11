import { useState, useEffect, startTransition } from 'react'
import { apiClient } from '../utils/apiClient'

/** SSB NACE code from hierarchy API */
interface SsbNaceCode {
    code: string
    parent: string
    level: number
    name: string
}

/** Global cache for SSB NACE hierarchy */
let ssbNaceCache: Record<string, string> = {}
let cachePromise: Promise<void> | null = null

/**
 * Load SSB NACE hierarchy into cache (single load)
 */
async function loadSsbNaceCache(): Promise<void> {
    if (cachePromise) {
        return cachePromise
    }

    if (Object.keys(ssbNaceCache).length > 0) {
        return Promise.resolve()
    }

    cachePromise = apiClient.get<SsbNaceCode[]>('/v1/companies/nace/hierarchy')
        .then(res => {
            for (const item of res.data) {
                ssbNaceCache[item.code] = item.name
            }
        })
        .catch(err => {
            console.error('Failed to load NACE hierarchy:', err)
        })

    return cachePromise
}

/**
 * Get NACE name from cache (sync, after load)
 */
export function getNaceNameFromCache(code: string): string {
    // Try exact match
    if (ssbNaceCache[code]) {
        return ssbNaceCache[code]
    }

    // Try without dots for section codes
    const cleanCode = code.replace(/\./g, '')
    if (ssbNaceCache[cleanCode]) {
        return ssbNaceCache[cleanCode]
    }

    return 'Ukjent'
}

/**
 * Hook to get NACE name for a code with SSB lookup
 */
export function useNaceName(code: string | null): string {
    const [name, setName] = useState<string>(() => {
        if (!code) return ''
        return getNaceNameFromCache(code)
    })
    const [loaded, setLoaded] = useState(Object.keys(ssbNaceCache).length > 0)

    useEffect(() => {
        if (!code) {
            startTransition(() => setName(''))
            return
        }

        // If cache is already loaded, use it
        if (loaded || Object.keys(ssbNaceCache).length > 0) {
            startTransition(() => setName(getNaceNameFromCache(code)))
            return
        }

        // Load cache and update
        loadSsbNaceCache().then(() => {
            startTransition(() => {
                setLoaded(true)
                setName(getNaceNameFromCache(code))
            })
        })
    }, [code, loaded])

    return name
}

/**
 * Preload SSB NACE hierarchy cache
 */
export function preloadNaceCache(): void {
    loadSsbNaceCache()
}
