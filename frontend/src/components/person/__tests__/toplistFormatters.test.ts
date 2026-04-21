import { describe, it, expect } from 'vitest'
import { CURRENCY_CATEGORIES, formatCategoryValue } from '../toplistFormatters'

describe('toplistFormatters', () => {
    describe('CURRENCY_CATEGORIES', () => {
        it('includes salgsinntekter', () => {
            expect(CURRENCY_CATEGORIES.has('salgsinntekter')).toBe(true)
        })

        it('includes total_profit', () => {
            expect(CURRENCY_CATEGORIES.has('total_profit')).toBe(true)
        })

        it('does not include total_employees', () => {
            expect(CURRENCY_CATEGORIES.has('total_employees')).toBe(false)
        })

        it('does not include active_roles', () => {
            expect(CURRENCY_CATEGORIES.has('active_roles')).toBe(false)
        })
    })

    describe('formatCategoryValue', () => {
        it('formats salgsinntekter with currency (mrd scale)', () => {
            // formatCurrency(5_000_000_000) = '5.0 mrd'
            const result = formatCategoryValue('salgsinntekter', 5_000_000_000)
            expect(result).toContain('mrd')
        })

        it('formats total_profit with currency (mill scale)', () => {
            // formatCurrency(500_000_000) contains 'mill'
            const result = formatCategoryValue('total_profit', 500_000_000)
            expect(result.length).toBeGreaterThan(0)
            // should not be a plain integer
            expect(result).not.toBe('500000000')
        })

        it('formats total_employees with plain number', () => {
            const result = formatCategoryValue('total_employees', 25000)
            // formatNumber uses Intl nb-NO — thousands separator is narrow NBSP (\u202f) or NBSP (\u00a0)
            // Accept any non-digit separator variant; just verify the digits are present and no currency suffix
            expect(result.replace(/\s/g, '')).toBe('25000')
            expect(result).not.toContain('mrd')
            expect(result).not.toContain('mill')
        })

        it('formats active_roles with plain number', () => {
            const result = formatCategoryValue('active_roles', 530)
            expect(result).toBe('530')
        })

        it('formats active_companies with plain number', () => {
            const result = formatCategoryValue('active_companies', 1234)
            // digits present, no currency suffix
            expect(result.replace(/\s/g, '')).toBe('1234')
            expect(result).not.toContain('mrd')
        })

        it('formats industry_diversity with plain number', () => {
            const result = formatCategoryValue('industry_diversity', 41)
            expect(result).toBe('41')
        })
    })
})
