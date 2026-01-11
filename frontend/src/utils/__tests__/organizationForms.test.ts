import { describe, it, expect } from 'vitest'
import {
    ORGANIZATION_FORM_MAP,
    getOrganizationFormLabel,
    getOrganizationFormName
} from '../organizationForms'

describe('organizationForms', () => {
    describe('ORGANIZATION_FORM_MAP', () => {
        it('contains common organization forms', () => {
            expect(ORGANIZATION_FORM_MAP['AS']).toBe('Aksjeselskap')
            expect(ORGANIZATION_FORM_MAP['ASA']).toBe('Allmennaksjeselskap')
            expect(ORGANIZATION_FORM_MAP['ENK']).toBe('Enkeltpersonforetak')
            expect(ORGANIZATION_FORM_MAP['NUF']).toBe('Norskregistrert utenlandsk foretak')
        })

        it('contains bankruptcy bo', () => {
            expect(ORGANIZATION_FORM_MAP['KBO']).toBe('Konkursbo')
        })

        it('contains all expected codes', () => {
            // Verify map is not empty
            expect(Object.keys(ORGANIZATION_FORM_MAP).length).toBeGreaterThan(40)
        })
    })

    describe('getOrganizationFormLabel', () => {
        it('returns full name with code for known org forms', () => {
            expect(getOrganizationFormLabel('AS')).toBe('Aksjeselskap (AS)')
            expect(getOrganizationFormLabel('ASA')).toBe('Allmennaksjeselskap (ASA)')
        })

        it('returns just the code for unknown org forms', () => {
            expect(getOrganizationFormLabel('XYZ')).toBe('XYZ')
        })

        it('returns "Ukjent" for null/undefined', () => {
            expect(getOrganizationFormLabel(null)).toBe('Ukjent')
            expect(getOrganizationFormLabel(undefined)).toBe('Ukjent')
        })

        it('returns "Ukjent" for empty string', () => {
            expect(getOrganizationFormLabel('')).toBe('Ukjent')
        })
    })

    describe('getOrganizationFormName', () => {
        it('returns just the full name for known org forms', () => {
            expect(getOrganizationFormName('AS')).toBe('Aksjeselskap')
            expect(getOrganizationFormName('ENK')).toBe('Enkeltpersonforetak')
        })

        it('returns the code for unknown org forms', () => {
            expect(getOrganizationFormName('XYZ')).toBe('XYZ')
        })

        it('returns "Ukjent" for null/undefined', () => {
            expect(getOrganizationFormName(null)).toBe('Ukjent')
            expect(getOrganizationFormName(undefined)).toBe('Ukjent')
        })
    })
})
