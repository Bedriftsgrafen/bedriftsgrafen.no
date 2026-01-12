import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Must mock matchMedia BEFORE importing the store, as the store initializes a listener on import
vi.hoisted(() => {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(), // deprecated
            removeListener: vi.fn(), // deprecated
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
});

import { useThemeStore, getResolvedTheme } from '../themeStore';

describe('themeStore', () => {
    beforeEach(() => {
        useThemeStore.setState({ theme: 'system' });
        // Clear mocks if any
        vi.clearAllMocks();
    });

    it('initializes with system theme', () => {
        const { result } = renderHook(() => useThemeStore());
        expect(result.current.theme).toBe('system');
    });

    it('updates theme', () => {
        const { result } = renderHook(() => useThemeStore());

        act(() => {
            result.current.setTheme('dark');
        });

        expect(result.current.theme).toBe('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('applies light theme', () => {
        const { result } = renderHook(() => useThemeStore());

        act(() => {
            result.current.setTheme('light');
        });

        expect(result.current.theme).toBe('light');
        expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('getResolvedTheme handles system preference', () => {
        // Mock matchMedia
        window.matchMedia = vi.fn().mockImplementation(query => ({
            matches: query === '(prefers-color-scheme: dark)',
            media: query,
            onchange: null,
            addListener: vi.fn(), // deprecated
            removeListener: vi.fn(), // deprecated
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));

        expect(getResolvedTheme('system')).toBe('dark');
        expect(getResolvedTheme('light')).toBe('light');
        expect(getResolvedTheme('dark')).toBe('dark');
    });
});
