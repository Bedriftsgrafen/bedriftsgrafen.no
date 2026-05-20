import { describe, expect, it } from 'vitest'
import {
    canRunCompanySearch,
    getCompanySearchValidationMessage,
    isShortCompanyTextSearch,
    normalizeCompanySearchQuery,
} from '../searchValidation'

describe('company search validation', () => {
    it('normalizes surrounding whitespace', () => {
        expect(normalizeCompanySearchQuery('  Equinor  ')).toBe('Equinor')
    })

    it('allows empty queries to stay idle without validation noise', () => {
        expect(getCompanySearchValidationMessage('')).toBeNull()
        expect(canRunCompanySearch('')).toBe(false)
    })

    it('rejects broad short text searches', () => {
        expect(getCompanySearchValidationMessage('as')).toBe('Skriv minst 3 tegn for virksomhetssøk.')
        expect(canRunCompanySearch('as')).toBe(false)
        expect(isShortCompanyTextSearch('as')).toBe(true)
    })

    it('allows valid text and full organization number searches', () => {
        expect(canRunCompanySearch('equinor')).toBe(true)
        expect(canRunCompanySearch('923609016')).toBe(true)
        expect(isShortCompanyTextSearch('923609016')).toBe(false)
    })

    it('rejects partial organization numbers', () => {
        expect(getCompanySearchValidationMessage('923')).toBe('Skriv hele organisasjonsnummeret (9 sifre).')
        expect(canRunCompanySearch('923')).toBe(false)
    })
})