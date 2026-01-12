import { describe, it, expect } from 'vitest';
import {
    prepareFinancialChartData,
    prepareMarginChartData,
    calculateEBITDA,
    calculateGrowth
} from '../chartTransformers';
import { Accounting } from '../../types';

describe('chartTransformers', () => {
    describe('prepareFinancialChartData', () => {
        it('transforms and sorts data correctly', () => {
            const input = [
                { aar: 2023, salgsinntekter: 100, aarsresultat: 10, egenkapital: 50 },
                { aar: 2022, salgsinntekter: 90, aarsresultat: 9, egenkapital: 45 }
            ] as Accounting[];

            const result = prepareFinancialChartData(input);

            expect(result).toHaveLength(2);
            expect(result[0].year).toBe('2022');
            expect(result[1].year).toBe('2023');
            expect(result[1].inntekt).toBe(100);
        });

        it('handles null values', () => {
            const input = [{ aar: 2023, salgsinntekter: null }] as Accounting[];
            const result = prepareFinancialChartData(input);
            expect(result[0].inntekt).toBe(0);
        });
    });

    describe('prepareMarginChartData', () => {
        it('calculates margins correctly', () => {
            const input = [{
                aar: 2023,
                salgsinntekter: 100,
                driftsresultat: 20,
                aarsresultat: 10
            }] as Accounting[];

            const result = prepareMarginChartData(input);
            // 20 / 100 = 20%
            expect(result[0].driftsmargin).toBe(20);
            // 10 / 100 = 10%
            expect(result[0].resultatmargin).toBe(10);
        });

        it('returns nulls for zero revenue', () => {
            const input = [{ aar: 2023, salgsinntekter: 0 }] as Accounting[];
            const result = prepareMarginChartData(input);
            expect(result[0].driftsmargin).toBeNull();
        });
    });

    describe('calculateEBITDA', () => {
        it('calculates properly', () => {
            const acc = { driftsresultat: 100, avskrivninger: 20 } as Accounting;
            expect(calculateEBITDA(acc)).toBe(120);
        });

        it('handles null driftsresultat', () => {
            const acc = { driftsresultat: null } as Accounting;
            expect(calculateEBITDA(acc)).toBeNull();
        });
    });

    describe('calculateGrowth', () => {
        it('calculates percentage growth', () => {
            expect(calculateGrowth(110, 100)).toBe(10); // 10% increase
            expect(calculateGrowth(90, 100)).toBe(-10); // 10% decrease
        });

        it('returns null if input missing', () => {
            expect(calculateGrowth(100, null)).toBeNull();
        });
    });
});
