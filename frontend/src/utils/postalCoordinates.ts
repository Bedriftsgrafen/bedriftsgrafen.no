/**
 * Norwegian postal code to coordinates lookup.
 * Uses complete official data from Kartverket/Geonorge (3375+ postal codes).
 */

/** Coordinate tuple [latitude, longitude] */
export type Coordinates = [number, number]

/** Default coordinates (Oslo sentrum) when postal code not found */
export const DEFAULT_COORDINATES: Coordinates = [59.9139, 10.7522]

/** Cached postal coordinates after loading */
let postalCoordsCache: Record<string, Coordinates> | null = null

/** Loading promise to prevent multiple fetches */
let loadingPromise: Promise<Record<string, Coordinates>> | null = null

/**
 * Load the complete postal code database.
 * This is cached after first load (~87KB, 3375 entries).
 */
export async function loadPostalCoordinates(): Promise<Record<string, Coordinates>> {
    if (postalCoordsCache) {
        return postalCoordsCache
    }

    if (loadingPromise) {
        return loadingPromise
    }

    loadingPromise = fetch('/postal-coords.json')
        .then(res => res.json())
        .then(data => {
            postalCoordsCache = data
            return data
        })
        .catch(err => {
            console.error('Failed to load postal coordinates:', err)
            return {}
        })

    return loadingPromise
}

/**
 * Get coordinates for a Norwegian postal code (sync version).
 * Uses cached data if available, otherwise returns default.
 * Call loadPostalCoordinates() first to ensure data is loaded.
 */
export function getCoordinatesForPostalCode(postalCode: string | undefined): Coordinates {
    if (!postalCode) {
        return DEFAULT_COORDINATES
    }

    // Clean the postal code (remove spaces, take first 4 digits)
    const cleanCode = postalCode.replace(/\s/g, '').substring(0, 4)

    if (postalCoordsCache && postalCoordsCache[cleanCode]) {
        return postalCoordsCache[cleanCode]
    }

    return DEFAULT_COORDINATES
}

/**
 * Get coordinates for a Norwegian postal code (async version).
 * Loads data if not already cached.
 */
export async function getCoordinatesForPostalCodeAsync(postalCode: string | undefined): Promise<Coordinates> {
    await loadPostalCoordinates()
    return getCoordinatesForPostalCode(postalCode)
}

/**
 * Check if a postal code exists in our database.
 */
export function hasPostalCode(postalCode: string | undefined): boolean {
    if (!postalCode || !postalCoordsCache) {
        return false
    }
    const cleanCode = postalCode.replace(/\s/g, '').substring(0, 4)
    return cleanCode in postalCoordsCache
}

/**
 * Generate Google Maps URL for an address.
 */
export function getGoogleMapsAddressUrl(address: string): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}
