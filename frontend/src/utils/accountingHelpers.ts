import type { Accounting } from '../types'

const DUPLICATE_SIGNATURE_FIELDS: Array<keyof Accounting> = [
    'total_inntekt',
    'aarsresultat',
    'egenkapital',
    'gjeldsgrad',
    'driftsresultat',
    'salgsinntekter',
    'omloepsmidler',
    'kortsiktig_gjeld',
    'avskrivninger',
    'sum_eiendeler',
]

const NORWEGIAN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

function formatMonthYear(value: string): string | null {
    const year = value.slice(0, 4)
    const monthIndex = parseInt(value.slice(5, 7), 10) - 1
    if (!year || monthIndex < 0 || monthIndex >= NORWEGIAN_MONTHS.length) return null
    return `${NORWEGIAN_MONTHS[monthIndex]} ${year}`
}

export function isFullCalendarAccountingYear(accounting: Accounting): boolean {
    return accounting.periode_fra === `${accounting.aar}-01-01` && accounting.periode_til === `${accounting.aar}-12-31`
}

export function formatAccountingPeriodRange(accounting: Accounting): string | null {
    if (!accounting.periode_fra || !accounting.periode_til) return null

    const start = formatMonthYear(accounting.periode_fra)
    const end = formatMonthYear(accounting.periode_til)
    if (!start || !end) return null

    return `${start} - ${end}`
}

export function shouldShowAccountingPeriod(accounting: Accounting, hasSameYearSiblings = false): boolean {
    return Boolean(
        accounting.periode_fra &&
        accounting.periode_til &&
        (hasSameYearSiblings || !isFullCalendarAccountingYear(accounting))
    )
}

function compareNullableIsoDateDesc(a: string | null | undefined, b: string | null | undefined): number {
    if (a && b && a !== b) return b.localeCompare(a)
    if (a && !b) return -1
    if (!a && b) return 1
    return 0
}

export function compareAccountingsByRecency(a: Accounting, b: Accounting): number {
    if (b.aar !== a.aar) return b.aar - a.aar

    const periodMetadata = periodMetadataScore(b) - periodMetadataScore(a)
    if (periodMetadata !== 0) return periodMetadata

    const periodEnd = compareNullableIsoDateDesc(a.periode_til, b.periode_til)
    if (periodEnd !== 0) return periodEnd

    const periodStart = compareNullableIsoDateDesc(a.periode_fra, b.periode_fra)
    if (periodStart !== 0) return periodStart

    return (b.id ?? 0) - (a.id ?? 0)
}

export function sortAccountingsByRecency(records: Accounting[]): Accounting[] {
    return [...records].sort(compareAccountingsByRecency)
}

function periodMetadataScore(record: Accounting): number {
    return (record.periode_fra ? 1 : 0) + (record.periode_til ? 1 : 0)
}

function sourceIdentity(record: Accounting): string | null {
    if (record.source_id) return `source:${record.source_id}`
    if (record.journalnr) return `journal:${record.journalnr}`
    return null
}

function duplicateSignature(record: Accounting): string {
    return [
        record.aar,
        ...DUPLICATE_SIGNATURE_FIELDS.map(field => record[field] ?? ''),
    ].join('|')
}

export function collapseLegacyAccountingDuplicates(records: Accounting[]): Accounting[] {
    const collapsed: Accounting[] = []

    for (const record of sortAccountingsByRecency(records)) {
        const source = sourceIdentity(record)
        const signature = duplicateSignature(record)
        const score = periodMetadataScore(record)
        const duplicateIndex = collapsed.findIndex(existing => {
            const existingSource = sourceIdentity(existing)
            if (source && existingSource) return source === existingSource

            return duplicateSignature(existing) === signature &&
                periodMetadataScore(existing) !== score
        })

        if (duplicateIndex === -1) {
            collapsed.push(record)
            continue
        }

        if (score > periodMetadataScore(collapsed[duplicateIndex])) {
            collapsed[duplicateIndex] = record
        }
    }

    return sortAccountingsByRecency(collapsed)
}

export function getDisplayAccountings(records: Accounting[]): Accounting[] {
    return collapseLegacyAccountingDuplicates(records)
}

export function getPreferredAccounting(records: Accounting[]): Accounting | null {
    return getDisplayAccountings(records).find(acc =>
        acc.salgsinntekter != null ||
        acc.aarsresultat != null ||
        acc.sum_eiendeler != null
    ) ?? null
}

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
