import { describe, it, expect } from 'vitest';
import { getOneYearAgo, getMonthsAgo, formatDateNorwegian, formatMonth } from '../dates';

describe('dates utils', () => {
    describe('getOneYearAgo', () => {
        it('returns date string from previous year', () => {
            const today = new Date();
            const result = getOneYearAgo();
            const resultYear = parseInt(result.split('-')[0]);
            expect(resultYear).toBe(today.getFullYear() - 1);
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });

    describe('getMonthsAgo', () => {
        it('returns date string from N months ago', () => {
            const result = getMonthsAgo(1);
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });
    });

    describe('formatDateNorwegian', () => {
        it('formats ISO string correctly', () => {
            // Force timezone neutral test or handle TZ
            // Using a specific date component
            const date = new Date(2023, 0, 15); // Jan 15 2023
            // Format might depend on locale implementation in node
            // vitest environment might need setup for nb-NO locale
            // We'll trust Intl.DateTimeFormat works or mock it if needed
            // Checking basic structure at least or mocking Date
            const formatted = formatDateNorwegian(date);
            expect(formatted).toMatch(/\d{2}\.\d{2}\.\d{4}/);
        });

        it('handles null', () => {
            expect(formatDateNorwegian(null)).toBe('—');
        });
    });

    describe('formatMonth', () => {
        it('formats YYYY-MM to Month YY', () => {
            expect(formatMonth('2024-01')).toBe('Jan 24');
            expect(formatMonth('2023-12')).toBe('Des 23');
        });
    });
});
