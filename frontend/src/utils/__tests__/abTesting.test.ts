import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useABTest } from '../abTesting';

describe('useABTest', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('assigns a variant randomly and persists it', () => {
        const variants = ['A', 'B'];
        const { result } = renderHook(() => useABTest('test-exp', variants));

        const assigned = result.current;
        expect(variants).toContain(assigned);
        expect(localStorage.getItem('bg_ab_test-exp')).toBe(assigned);
    });

    it('retrieves existing variant from storage', () => {
        localStorage.setItem('bg_ab_test-exp', 'B');
        const { result } = renderHook(() => useABTest('test-exp', ['A', 'B']));
        expect(result.current).toBe('B');
    });
});
