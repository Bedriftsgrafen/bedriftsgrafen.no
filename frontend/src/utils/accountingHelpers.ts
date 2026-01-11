import type { Accounting } from '../types'

/**
 * Deduplicate accounting records by year.
 * If multiple records exist for the same year, prefers the one with higher revenue.
 * This handles cases where companies have multiple fiscal periods in the same calendar year.
 * 
 * @param records - Array of accounting records to deduplicate
 * @returns Deduplicated array of accounting records
 */
export function deduplicateAccountingsByYear(
    records: Accounting[]
): Accounting[] {
    const map = new Map<number, Accounting>()

    for (const record of records) {
        const existing = map.get(record.aar)
        if (!existing) {
            map.set(record.aar, record)
        } else {
            // Keep the one with higher revenue (likely the consolidated/main one)
            const existingRev = existing.salgsinntekter || 0
            const currentRev = record.salgsinntekter || 0
            if (currentRev > existingRev) {
                map.set(record.aar, record)
            }
        }
    }

    return Array.from(map.values())
}
