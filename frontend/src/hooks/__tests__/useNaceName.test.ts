import { renderHook } from '@testing-library/react';
import { useNaceName, getNaceNameFromCache, preloadNaceCache } from '../useNaceName';
import { apiClient } from '../../utils/apiClient';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';

// Mock API client
vi.mock('../../utils/apiClient');

describe('useNaceName', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns empty string for null code', () => {
        const { result } = renderHook(() => useNaceName(null));
        expect(result.current).toBe('');
    });

    it('returns code immediately if in cache (mocked)', () => {
        (apiClient.get as Mock).mockResolvedValue({
            data: [{ code: '01.110', name: 'Agriculture' }]
        });

        preloadNaceCache();
    });

    it('getNaceNameFromCache returns expected values', () => {
        expect(getNaceNameFromCache('99.999')).toBe('Ukjent');
    });
});
