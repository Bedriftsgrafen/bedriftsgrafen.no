import { describe, it, expect } from 'vitest';
import {
    collapseLegacyAccountingDuplicates,
    deduplicateAccountingsByYear,
    formatAccountingPeriodRange,
    getDisplayAccountings,
    getPreferredAccounting,
    shouldShowAccountingPeriod,
    sortAccountingsByRecency,
} from '../accountingHelpers';
import { Accounting } from '../../types';

describe('accountingHelpers', () => {
    describe('deduplicateAccountingsByYear', () => {
        it('removes duplicates, keeping highest revenue', () => {
            const records = [
                { aar: 2023, salgsinntekter: 100, id: 1 },
                { aar: 2023, salgsinntekter: 500, id: 2 }, // Winner
                { aar: 2022, salgsinntekter: 200, id: 3 },
            ] as Accounting[];

            const result = deduplicateAccountingsByYear(records);

            expect(result).toHaveLength(2);
            const winner2023 = result.find(r => r.aar === 2023);
            expect(winner2023?.salgsinntekter).toBe(500);
        });

        it('handles single records correctly', () => {
            const records = [{ aar: 2023, salgsinntekter: 100 }] as Accounting[];
            const result = deduplicateAccountingsByYear(records);
            expect(result).toHaveLength(1);
        });

        it('handles empty input', () => {
            expect(deduplicateAccountingsByYear([])).toHaveLength(0);
        });
    });

    describe('sortAccountingsByRecency', () => {
        it('prefers complete fiscal-period metadata before fallback period ends', () => {
            const records = [
                { id: 1, aar: 2025, periode_fra: null, periode_til: null, salgsinntekter: 100 },
                { id: 2, aar: 2025, periode_fra: '2024-08-16', periode_til: '2025-06-30', salgsinntekter: 100 },
                { id: 3, aar: 2024, periode_fra: '2024-01-01', periode_til: '2024-12-31', salgsinntekter: 100 },
                { id: 4, aar: 2025, periode_fra: null, periode_til: '2025-12-31', salgsinntekter: 100 },
            ] as Accounting[];

            const result = sortAccountingsByRecency(records);

            expect(result.map(r => r.id)).toEqual([2, 4, 1, 3]);
        });
    });

    describe('collapseLegacyAccountingDuplicates', () => {
        it('collapses exact legacy duplicates and keeps the row with period metadata', () => {
            const records = [
                { id: 1, aar: 2025, periode_fra: null, periode_til: null, source_id: '6335555', salgsinntekter: 19922044, aarsresultat: -3925770 },
                { id: 2, aar: 2025, periode_fra: '2024-07-01', periode_til: '2025-06-30', source_id: '6335555', salgsinntekter: 19922044, aarsresultat: -3925770 },
                { id: 3, aar: 2024, periode_fra: null, periode_til: '2024-12-31', salgsinntekter: 17142624, aarsresultat: -5017296 },
            ] as Accounting[];

            const result = collapseLegacyAccountingDuplicates(records);

            expect(result.map(r => r.id)).toEqual([2, 3]);
        });

        it('keeps identical zero-value periods when they come from different Brreg statements', () => {
            const records = [
                { id: 1, aar: 2025, periode_fra: '2025-01-01', periode_til: '2025-06-30', source_id: 'one', salgsinntekter: 0, aarsresultat: 0 },
                { id: 2, aar: 2025, periode_fra: '2025-07-01', periode_til: '2025-12-31', source_id: 'two', salgsinntekter: 0, aarsresultat: 0 },
            ] as Accounting[];

            expect(getDisplayAccountings(records).map(r => r.id)).toEqual([2, 1]);
        });

        it('keeps same-year records when the financial values differ', () => {
            const records = [
                { id: 1, aar: 2025, periode_fra: '2025-01-01', periode_til: '2025-06-30', salgsinntekter: 100, aarsresultat: 10 },
                { id: 2, aar: 2025, periode_fra: '2025-07-01', periode_til: '2025-12-31', salgsinntekter: 200, aarsresultat: 20 },
            ] as Accounting[];

            expect(getDisplayAccountings(records).map(r => r.id)).toEqual([2, 1]);
        });
    });

    describe('period display helpers', () => {
        it('formats non-calendar accounting periods', () => {
            const accounting = {
                id: 1,
                aar: 2025,
                periode_fra: '2024-07-01',
                periode_til: '2025-06-30',
            } as Accounting;

            expect(formatAccountingPeriodRange(accounting)).toBe('jul 2024 - jun 2025');
            expect(shouldShowAccountingPeriod(accounting)).toBe(true);
        });

        it('hides full calendar period labels unless there are same-year siblings', () => {
            const accounting = {
                id: 1,
                aar: 2024,
                periode_fra: '2024-01-01',
                periode_til: '2024-12-31',
            } as Accounting;

            expect(formatAccountingPeriodRange(accounting)).toBe('jan 2024 - des 2024');
            expect(shouldShowAccountingPeriod(accounting)).toBe(false);
            expect(shouldShowAccountingPeriod(accounting, true)).toBe(true);
        });
    });

    describe('getPreferredAccounting', () => {
        it('returns the latest usable accounting period', () => {
            const records = [
                { id: 1, aar: 2025, periode_fra: null, periode_til: null, salgsinntekter: 100 },
                { id: 2, aar: 2025, periode_fra: '2024-08-16', periode_til: '2025-06-30', salgsinntekter: 100 },
            ] as Accounting[];

            expect(getPreferredAccounting(records)?.id).toBe(2);
        });
    });
});
