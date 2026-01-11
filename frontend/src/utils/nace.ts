/**
 * Determines the granularity level of a NACE code.
 * @param naceCode The NACE code to check.
 * @returns 'Underbransje' (5 digits) or 'Hovedbransje' (2 digits).
 */
export function getNaceLevel(naceCode: string): 'Underbransje' | 'Hovedbransje' {
    // Basic logic: if length > 2 (e.g. "62.010"), it's a subclass
    // If length is 2 (e.g. "62"), it's a division (main industry)
    return naceCode.length > 2 ? 'Underbransje' : 'Hovedbransje'
}
