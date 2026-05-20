import { normalizeSearchQuery } from './formatters'

export const MIN_COMPANY_TEXT_SEARCH_LENGTH = 3

function compactDigits(value: string): string {
    return value.replace(/[ .-]/g, '')
}

export function normalizeCompanySearchQuery(query: string): string {
    return normalizeSearchQuery(query.trim())
}

export function getCompanySearchValidationMessage(query: string): string | null {
    const normalized = normalizeCompanySearchQuery(query)
    if (!normalized) return null

    const compact = compactDigits(normalized)
    if (/^\d+$/.test(compact) && compact.length !== 9) {
        return 'Skriv hele organisasjonsnummeret (9 sifre).'
    }

    if (!/^\d+$/.test(compact) && normalized.length < MIN_COMPANY_TEXT_SEARCH_LENGTH) {
        return `Skriv minst ${MIN_COMPANY_TEXT_SEARCH_LENGTH} tegn for virksomhetssøk.`
    }

    return null
}

export function canRunCompanySearch(query: string): boolean {
    const normalized = normalizeCompanySearchQuery(query)
    return Boolean(normalized) && getCompanySearchValidationMessage(normalized) === null
}

export function isShortCompanyTextSearch(query: string | null | undefined): boolean {
    if (!query) return false
    const normalized = normalizeCompanySearchQuery(query)
    if (!normalized) return false

    const compact = compactDigits(normalized)
    return !/^\d+$/.test(compact) && normalized.length < MIN_COMPANY_TEXT_SEARCH_LENGTH
}