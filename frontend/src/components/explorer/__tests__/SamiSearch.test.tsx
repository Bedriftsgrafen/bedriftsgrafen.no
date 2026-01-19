import { describe, it, expect } from 'vitest'
import { formatMunicipalityName, SAMI_NAME_MAPPING } from '../../../constants/municipalities'

describe('Sami Name Mapping', () => {
    it('correctly maps Sami names to Norwegian canonical names', () => {
        expect(SAMI_NAME_MAPPING['HÁBMER']).toBe('HAMARØY')
        expect(SAMI_NAME_MAPPING['GUOVDAGEAIDNU']).toBe('KAUTOKEINO')
    })

    it('formatMunicipalityName returns Norwegian name for Sami input', () => {
        // Should map Hábmer -> Hamarøy (Hábmer)
        expect(formatMunicipalityName('HÁBMER')).toBe('Hamarøy (Hábmer)')
        expect(formatMunicipalityName('habmer')).toBe('Hamarøy (Habmer)')
    })

    it('formatMunicipalityName handles normal names correctly', () => {
        expect(formatMunicipalityName('OSLO')).toBe('Oslo')
        expect(formatMunicipalityName('MØRE OG ROMSDAL')).toBe('Møre Og Romsdal')
        expect(formatMunicipalityName('AURSKOG-HØLAND')).toBe('Aurskog-Høland')
    })
})

// Since we want to test the RegionPickerModal logic without full JSDOM complexity
// we can verify the state sync logic if we were to unit test the component.
// But for now, we'll focus on the mapping logic which was the cause of UI mismatch.
