import { describe, expect, it } from 'vitest'
import { AFFILIATE_LINKS, AFFILIATIONS, ALL_AFFILIATIONS, GLOBAL_AFFILIATIONS } from '../affiliations'

describe('affiliate constants', () => {
    it('uses internal redirect links for all paid affiliations', () => {
        expect(AFFILIATE_LINKS.tjenestetorget).toBe('/api/v1/affiliates/tjenestetorget')
        expect(AFFILIATE_LINKS.klikklaan).toBe('/api/v1/affiliates/klikklaan')
        expect(AFFILIATE_LINKS.zensum).toBe('/api/v1/affiliates/zensum')
        expect(AFFILIATE_LINKS.rentesjekk).toBe('/api/v1/affiliates/rentesjekk')
        expect(AFFILIATE_LINKS.tjenestetorgetForsikring).toBe('/api/v1/affiliates/tjenestetorget-forsikring')
        expect(AFFILIATE_LINKS.uscore).toBe('/api/v1/affiliates/uscore')

        for (const affiliation of Object.values(AFFILIATIONS)) {
            expect(affiliation.link).toMatch(/^\/api\/v1\/affiliates\//)
            expect(affiliation.isPlaceholder).not.toBe(true)
        }
    })

    it('does not include public tracker URLs or Vite affiliate env names', () => {
        const serialized = JSON.stringify({ AFFILIATE_LINKS, AFFILIATIONS })

        expect(serialized).not.toMatch(/VITE_/)
        expect(serialized).not.toMatch(/go\.adt/)
        expect(serialized).not.toMatch(/on\.rentesjekk/)
    })

    it('exposes all paid affiliations and caps the default global set', () => {
        expect(ALL_AFFILIATIONS.map((affiliation) => affiliation.id)).toEqual([
            'tjenestetorget_accountant',
            'klikklaan_loan',
            'zensum_loan',
            'rentesjekk_debt',
            'tjenestetorget_insurance',
            'uscore_finance',
        ])

        expect(GLOBAL_AFFILIATIONS.map((affiliation) => affiliation.id)).toEqual([
            'tjenestetorget_accountant',
            'klikklaan_loan',
            'zensum_loan',
        ])
        expect(GLOBAL_AFFILIATIONS).toHaveLength(3)
    })

    it('uses compact logo dimensions for raster affiliate assets', () => {
        expect(AFFILIATIONS.TJENESTETORGET_ACCOUNTANT).toMatchObject({
            logoWidth: 120,
            logoHeight: 40,
        })
        expect(AFFILIATIONS.KLIKKLAAN_LOAN).toMatchObject({
            logoWidth: 135,
            logoHeight: 40,
        })
        expect(AFFILIATIONS.RENTESJEKK_DEBT).toMatchObject({
            logoWidth: 300,
            logoHeight: 100,
        })
        expect(AFFILIATIONS.USCORE_FINANCE).toMatchObject({
            logoWidth: 300,
            logoHeight: 100,
        })
    })
})
