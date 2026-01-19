import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    formatNOK,
    formatPercent,
    formatLargeNumber,
    formatDistanceToNow,
    getKpiDescription,
    formatDate,
    getKpiColor
} from '../formatters'

describe('formatters', () => {
    describe('formatNOK', () => {
        it('formats number as NOK currency', () => {
            // Note: The exact output depends on the locale, but we expect "kr" and spaces
            const result = formatNOK(1000000)
            expect(result).toContain('kr')
            expect(result).toContain('1')
            expect(result).toContain('000')
        })

        it('handles null/undefined', () => {
            expect(formatNOK(null)).toBe('-')
            expect(formatNOK(undefined)).toBe('-')
        })

        it('handles zero', () => {
            const result = formatNOK(0)
            expect(result).toContain('kr')
            expect(result).toContain('0')
        })

        it('handles negative numbers', () => {
            const result = formatNOK(-500000)
            expect(result).toContain('kr')
        })
    })

    describe('formatPercent', () => {
        it('formats number as percentage', () => {
            expect(formatPercent(0.123)).toBe('12.3%')
            expect(formatPercent(0.5)).toBe('50.0%')
        })

        it('handles custom decimals', () => {
            expect(formatPercent(0.12345, 2)).toBe('12.35%')
        })

        it('handles null/undefined', () => {
            expect(formatPercent(null)).toBe('-')
        })

        it('handles zero', () => {
            expect(formatPercent(0)).toBe('0.0%')
        })

        it('handles negative values', () => {
            expect(formatPercent(-0.15)).toBe('-15.0%')
        })

        it('handles values over 100%', () => {
            expect(formatPercent(1.5)).toBe('150.0%')
        })
    })

    describe('formatLargeNumber', () => {
        it('formats billions', () => {
            expect(formatLargeNumber(1500000000)).toBe('1.5 mrd.')
        })

        it('formats millions', () => {
            expect(formatLargeNumber(1500000)).toBe('1.5 mill.')
        })

        it('formats thousands', () => {
            expect(formatLargeNumber(1500)).toBe('1.5 k')
        })

        it('formats small numbers', () => {
            expect(formatLargeNumber(500)).toBe('500')
        })

        it('handles null/undefined', () => {
            expect(formatLargeNumber(null)).toBe('-')
        })

        it('handles zero', () => {
            expect(formatLargeNumber(0)).toBe('0')
        })

        it('handles exact boundaries', () => {
            expect(formatLargeNumber(1000000000)).toBe('1.0 mrd.')
            expect(formatLargeNumber(1000000)).toBe('1.0 mill.')
            expect(formatLargeNumber(1000)).toBe('1.0 k')
        })
    })

    describe('formatDistanceToNow', () => {
        beforeEach(() => {
            vi.useFakeTimers()
            vi.setSystemTime(new Date('2025-01-15T12:00:00Z'))
        })

        afterEach(() => {
            vi.useRealTimers()
        })

        it('returns "nettopp" for recent timestamps', () => {
            const now = Date.now()
            expect(formatDistanceToNow(now - 30000)).toBe('nettopp') // 30 seconds ago
        })

        it('formats minutes correctly', () => {
            const now = Date.now()
            expect(formatDistanceToNow(now - 60000)).toBe('1 minutt siden')
            expect(formatDistanceToNow(now - 120000)).toBe('2 minutter siden')
        })

        it('formats hours correctly', () => {
            const now = Date.now()
            expect(formatDistanceToNow(now - 3600000)).toBe('1 time siden')
            expect(formatDistanceToNow(now - 7200000)).toBe('2 timer siden')
        })

        it('formats days correctly', () => {
            const now = Date.now()
            expect(formatDistanceToNow(now - 86400000)).toBe('1 dag siden')
            expect(formatDistanceToNow(now - 172800000)).toBe('2 dager siden')
        })
    })

    describe('getKpiDescription', () => {
        it('returns description for likviditetsgrad1', () => {
            const result = getKpiDescription('likviditetsgrad1')
            expect(result.name).toBe('Likviditetsgrad 1')
            expect(result.description).toContain('Omløpsmidler')
        })

        it('returns description for ebitda', () => {
            const result = getKpiDescription('ebitda')
            expect(result.name).toBe('EBITDA')
            expect(result.description).toContain('Driftsresultat')
        })

        it('returns description for ebitda_margin', () => {
            const result = getKpiDescription('ebitda_margin')
            expect(result.name).toBe('EBITDA-margin')
        })

        it('returns description for egenkapitalandel', () => {
            const result = getKpiDescription('egenkapitalandel')
            expect(result.name).toBe('Egenkapitalandel')
        })

        it('returns description for resultatgrad', () => {
            const result = getKpiDescription('resultatgrad')
            expect(result.name).toBe('Resultatgrad')
        })

        it('returns description for totalkapitalrentabilitet', () => {
            const result = getKpiDescription('totalkapitalrentabilitet')
            expect(result.name).toBe('Totalkapitalrentabilitet')
        })

        it('returns key as name for unknown keys', () => {
            const result = getKpiDescription('unknown_kpi')
            expect(result.name).toBe('unknown_kpi')
            expect(result.description).toBe('')
        })
    })

    describe('formatDate', () => {
        it('formats valid date string', () => {
            const result = formatDate('2025-01-15')
            expect(result).toMatch(/15.*01.*2025/)
        })

        it('handles null/undefined', () => {
            expect(formatDate(null)).toBe('-')
            expect(formatDate(undefined)).toBe('-')
        })

        it('handles empty string', () => {
            expect(formatDate('')).toBe('-')
        })

        it('handles ISO date string', () => {
            const result = formatDate('2024-12-25T10:30:00Z')
            expect(result).toMatch(/25.*12.*2024/)
        })
    })

    describe('getKpiColor', () => {
        it('returns gray for null values', () => {
            expect(getKpiColor('likviditetsgrad1', null)).toBe('text-gray-400')
        })

        describe('likviditetsgrad1', () => {
            it('returns green for values >= 2', () => {
                expect(getKpiColor('likviditetsgrad1', 2)).toBe('text-green-700')
                expect(getKpiColor('likviditetsgrad1', 3)).toBe('text-green-700')
            })

            it('returns yellow for values >= 1 and < 2', () => {
                expect(getKpiColor('likviditetsgrad1', 1)).toBe('text-yellow-800')
                expect(getKpiColor('likviditetsgrad1', 1.5)).toBe('text-yellow-800')
            })

            it('returns red for values < 1', () => {
                expect(getKpiColor('likviditetsgrad1', 0.5)).toBe('text-red-700')
                expect(getKpiColor('likviditetsgrad1', 0)).toBe('text-red-700')
            })
        })

        describe('ebitda_margin', () => {
            it('returns green for values >= 0.1', () => {
                expect(getKpiColor('ebitda_margin', 0.1)).toBe('text-green-700')
                expect(getKpiColor('ebitda_margin', 0.2)).toBe('text-green-700')
            })

            it('returns yellow for values >= 0.05 and < 0.1', () => {
                expect(getKpiColor('ebitda_margin', 0.05)).toBe('text-yellow-800')
                expect(getKpiColor('ebitda_margin', 0.08)).toBe('text-yellow-800')
            })

            it('returns red for values < 0.05', () => {
                expect(getKpiColor('ebitda_margin', 0.02)).toBe('text-red-700')
                expect(getKpiColor('ebitda_margin', -0.1)).toBe('text-red-700')
            })
        })

        describe('egenkapitalandel', () => {
            it('returns green for values >= 0.3', () => {
                expect(getKpiColor('egenkapitalandel', 0.3)).toBe('text-green-700')
            })

            it('returns yellow for values >= 0.2 and < 0.3', () => {
                expect(getKpiColor('egenkapitalandel', 0.2)).toBe('text-yellow-800')
            })

            it('returns red for values < 0.2', () => {
                expect(getKpiColor('egenkapitalandel', 0.1)).toBe('text-red-700')
            })
        })

        it('returns default color for unknown KPIs', () => {
            expect(getKpiColor('unknown_kpi', 0.5)).toBe('text-gray-700')
        })
    })
})
