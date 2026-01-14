import { renderHook, act } from '@testing-library/react';
import { usePagination } from '../usePagination';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock UI Store
const mockSetPage = vi.fn();
let mockUiState = {
    currentPage: 1,
    setPage: mockSetPage
};

vi.mock('../../store/uiStore', () => ({
    useUiStore: vi.fn((selector) => selector(mockUiState)),
}));

describe('usePagination', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSetPage.mockClear();
        mockUiState = {
            currentPage: 1,
            setPage: mockSetPage
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('computes isFirstPage correctly', () => {
        const { result } = renderHook(() => usePagination({ itemsPerPage: 10, currentItemsCount: 10 }));
        expect(result.current.isFirstPage).toBe(true);
        expect(result.current.isLastPage).toBe(false);
    });

    it('computes isLastPage correctly', () => {
        const { result } = renderHook(() => usePagination({ itemsPerPage: 10, currentItemsCount: 5 }));
        // If items < perPage, it's the last page
        expect(result.current.isLastPage).toBe(true);
    });

    it('handlePreviousPage decreases page', () => {
        mockUiState = {
            currentPage: 2,
            setPage: mockSetPage
        };

        const { result } = renderHook(() => usePagination({ itemsPerPage: 10, currentItemsCount: 10 }));

        act(() => {
            result.current.handlePreviousPage();
        });

        expect(mockSetPage).toHaveBeenCalledWith(1);
    });

    it('handleNextPage increases page if full page', () => {
        const { result } = renderHook(() => usePagination({ itemsPerPage: 10, currentItemsCount: 10 }));

        act(() => {
            result.current.handleNextPage();
        });

        expect(mockSetPage).toHaveBeenCalledWith(2);
    });

    it('handleNextPage does nothing if not full page', () => {
        const { result } = renderHook(() => usePagination({ itemsPerPage: 10, currentItemsCount: 9 }));

        act(() => {
            result.current.handleNextPage();
        });

        expect(mockSetPage).not.toHaveBeenCalled();
    });

    it('goToPage sets specific page', () => {
        const { result } = renderHook(() => usePagination({ itemsPerPage: 10, currentItemsCount: 10 }));

        act(() => {
            result.current.goToPage(5);
        });

        expect(mockSetPage).toHaveBeenCalledWith(5);
    });
});
