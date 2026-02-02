import { describe, it, expect, beforeEach } from 'vitest';
import { getCoordinatesForPostalCode, getCoordinatesForPostalCodeAsync, DEFAULT_COORDINATES, loadPostalCoordinates, resetCache } from '../postalCoordinates';

// Note: This test now uses MSW via setupTests.ts for fetch interception
// The postal-coords.json handler is defined in src/mocks/handlers.ts

describe('postalCoordinates util', () => {
    beforeEach(() => {
        // Reset module cache before each test
        resetCache();
    });

    describe('getCoordinatesForPostalCode (Sync)', () => {
        it('returns default if cache not loaded/empty', () => {
            // Cache is empty after reset, so should return default
            expect(getCoordinatesForPostalCode('0001')).toBe(DEFAULT_COORDINATES);
        });

        it('returns default for missing code', () => {
            expect(getCoordinatesForPostalCode(undefined)).toBe(DEFAULT_COORDINATES);
        });
    });

    describe('getCoordinatesForPostalCodeAsync', () => {
        it('fetches data and subsequent calls use cache', async () => {
            // First call should fetch via MSW
            const result1 = await getCoordinatesForPostalCodeAsync('0001');
            expect(result1).toEqual([59.9, 10.7]);

            // Second call should use cached data
            const result2 = await getCoordinatesForPostalCodeAsync('1234');
            expect(result2).toEqual([60.0, 11.0]);
        });

        it('handles cleaning of postal code', async () => {
            // Ensure data loaded
            await loadPostalCoordinates();
            const result = getCoordinatesForPostalCode(' 0001 ');
            expect(result).toEqual([59.9, 10.7]);
        });
    });
});
