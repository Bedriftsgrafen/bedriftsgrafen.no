import { describe, it, expect } from 'vitest';
import { deduplicateAccountingsByYear } from '../accountingHelpers';
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
});
