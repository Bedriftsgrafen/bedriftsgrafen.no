import { describe, expect, it } from 'vitest'
import { getNaceSectionName, NACE_DIVISION_TO_SECTION, NACE_SECTIONS } from '../naceSections'

describe('naceSections', () => {
    it('maps current SSB 2025 sections for the shifted service divisions', () => {
        expect(NACE_DIVISION_TO_SECTION['61']).toBe('K')
        expect(NACE_DIVISION_TO_SECTION['64']).toBe('L')
        expect(NACE_DIVISION_TO_SECTION['68']).toBe('M')
        expect(NACE_DIVISION_TO_SECTION['94']).toBe('T')
        expect(NACE_DIVISION_TO_SECTION['97']).toBe('U')
        expect(NACE_DIVISION_TO_SECTION['99']).toBe('V')
    })

    it('resolves section names from full NACE codes', () => {
        expect(getNaceSectionName('62.010')).toBe(NACE_SECTIONS.K)
        expect(getNaceSectionName('99.000')).toBe(NACE_SECTIONS.V)
    })
})