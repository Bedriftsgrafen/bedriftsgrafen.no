import { renderHook, act } from '@testing-library/react';
import { usePagination } from '../usePagination';
import { useUiStore } from '../../store/uiStore';
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';

// Mock UI Store
vi.mock('../../store/uiStore', () => ({
    useUiStore: vi.fn()
}));

describe('usePagination', () => {
    let mockSetPage: Mock;

    beforeEach(() => {
        mockSetPage = vi.fn();
        (useUiStore as unknown as Mock).mockReturnValue({
            currentPage: 1,
            setPage: mockSetPage
        });
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
        (useUiStore as unknown as Mock).mockReturnValue({
            currentPage: 2,
            setPage: mockSetPage
        });

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
