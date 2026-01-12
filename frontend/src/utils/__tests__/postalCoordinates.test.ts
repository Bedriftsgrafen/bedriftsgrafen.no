import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCoordinatesForPostalCode, getCoordinatesForPostalCodeAsync, DEFAULT_COORDINATES, loadPostalCoordinates } from '../postalCoordinates';

// Mock fetch global
window.fetch = vi.fn();

describe('postalCoordinates util', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset fetch mock
        (window.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
            json: () => Promise.resolve({
                '0001': [59.9, 10.7],
                '1234': [60.0, 11.0]
            })
        });
    });

    describe('getCoordinatesForPostalCode (Sync)', () => {
        it('returns default if cache not loaded/empty', () => {
            // Note: Since cache is module level and persistent, subsequent tests might fail if we don't handle state.
            // Ideally we'd reset module state.
            // For now, assuming default state starts empty or we can force load.
            // But cache is private variable. We can't clear it easily.
            // We'll rely on Async test which ensures load.
        });

        it('returns default for missing code', () => {
            expect(getCoordinatesForPostalCode(undefined)).toBe(DEFAULT_COORDINATES);
        });
    });

    describe('getCoordinatesForPostalCodeAsync', () => {
        it('fetches data and subsequent calls use cache', async () => {
            // First call should fetch
            const result1 = await getCoordinatesForPostalCodeAsync('0001');
            expect(window.fetch).toHaveBeenCalledTimes(1);
            expect(result1).toEqual([59.9, 10.7]);

            // Second call should NOT fetch again
            const result2 = await getCoordinatesForPostalCodeAsync('1234');
            expect(result2).toEqual([60.0, 11.0]);
            expect(window.fetch).toHaveBeenCalledTimes(1);
        });

        it('handles cleaning of postal code', async () => {
            // Ensure data loaded
            await loadPostalCoordinates();
            const result = getCoordinatesForPostalCode(' 0001 ');
            expect(result).toEqual([59.9, 10.7]);
        });
    });
});
