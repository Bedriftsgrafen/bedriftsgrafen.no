/**
 * Unit tests for useFilterParams hook.
 *
 * Tests filter transformation, validation, and memoization.
 */

import { describe, expect, it, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useFilterParams } from '../useFilterParams'
import { useFilterStore } from '../../store/filterStore'

// Mock the filter store
vi.mock('../../store/filterStore', () => ({
    useFilterStore: vi.fn(),
}))

const mockUseFilterStore = useFilterStore as unknown as ReturnType<typeof vi.fn>

// Default empty filter state
const emptyFilterState = {
    organizationForms: [],
    naeringskode: '',
    revenueMin: null,
    revenueMax: null,
    profitMin: null,
    profitMax: null,
    equityMin: null,
    equityMax: null,
    operatingProfitMin: null,
    operatingProfitMax: null,
    liquidityRatioMin: null,
    liquidityRatioMax: null,
    equityRatioMin: null,
    equityRatioMax: null,
    employeeMin: null,
    employeeMax: null,
    municipality: '',
    county: '',
    foundedFrom: null,
    foundedTo: null,
    bankruptFrom: null,
    bankruptTo: null,
    isBankrupt: null,
    inLiquidation: null,
    inForcedLiquidation: null,
    hasAccounting: null,
    sortBy: 'navn',
    sortOrder: 'asc' as const,
    searchQuery: '',
}

beforeEach(() => {
    mockUseFilterStore.mockReturnValue(emptyFilterState)
})

describe('useFilterParams', () => {
    it('returns filterParams object', () => {
        const { result } = renderHook(() => useFilterParams())

        expect(result.current.filterParams).toBeDefined()
        expect(result.current.sortBy).toBeDefined()
        expect(result.current.sortOrder).toBeDefined()
    })

    it('returns undefined for empty values', () => {
        const { result } = renderHook(() => useFilterParams())

        expect(result.current.filterParams.name).toBeUndefined()
        expect(result.current.filterParams.naeringskode).toBeUndefined()
        expect(result.current.filterParams.min_revenue).toBeUndefined()
    })
})

describe('Filter Value Transformation', () => {
    it('transforms searchQuery to name parameter', () => {
        mockUseFilterStore.mockReturnValue({
            ...emptyFilterState,
            searchQuery: 'test company',
        })

        const { result } = renderHook(() => useFilterParams())

        expect(result.current.filterParams.name).toBe('test company')
    })

    it('passes organizationForms array directly', () => {
        mockUseFilterStore.mockReturnValue({
            ...emptyFilterState,
            organizationForms: ['AS', 'ENK'],
        })

        const { result } = renderHook(() => useFilterParams())

        expect(result.current.filterParams.organisasjonsform).toEqual(['AS', 'ENK'])
    })

    it('formats date objects to ISO date strings', () => {
        const testDate = new Date('2023-06-15T12:00:00Z')
        mockUseFilterStore.mockReturnValue({
            ...emptyFilterState,
            foundedFrom: testDate,
        })

        const { result } = renderHook(() => useFilterParams())

        expect(result.current.filterParams.founded_from).toBe('2023-06-15')
    })
})

describe('Value Validation', () => {
    it('ensures revenue values are non-negative', () => {
        mockUseFilterStore.mockReturnValue({
            ...emptyFilterState,
            revenueMin: -1000,
            revenueMax: 5000,
        })

        const { result } = renderHook(() => useFilterParams())

        expect(result.current.filterParams.min_revenue).toBe(0) // Clamped to 0
        expect(result.current.filterParams.max_revenue).toBe(5000)
    })

    it('allows negative profit values (no clamping)', () => {
        mockUseFilterStore.mockReturnValue({
            ...emptyFilterState,
            profitMin: -500000,
            profitMax: 1000000,
        })

        const { result } = renderHook(() => useFilterParams())

        expect(result.current.filterParams.min_profit).toBe(-500000) // Negative allowed
        expect(result.current.filterParams.max_profit).toBe(1000000)
    })

    it('clamps equity ratio to 0-1 range', () => {
        mockUseFilterStore.mockReturnValue({
            ...emptyFilterState,
            equityRatioMin: -0.5,
            equityRatioMax: 1.5,
        })

        const { result } = renderHook(() => useFilterParams())

        expect(result.current.filterParams.min_equity_ratio).toBe(0) // Clamped to 0
        expect(result.current.filterParams.max_equity_ratio).toBe(1) // Clamped to 1
    })

    it('ensures employee counts are non-negative', () => {
        mockUseFilterStore.mockReturnValue({
            ...emptyFilterState,
            employeeMin: -10,
            employeeMax: 100,
        })

        const { result } = renderHook(() => useFilterParams())

        expect(result.current.filterParams.min_employees).toBe(0) // Clamped to 0
        expect(result.current.filterParams.max_employees).toBe(100)
    })
})

describe('Boolean Filters', () => {
    it('passes boolean filter values correctly', () => {
        mockUseFilterStore.mockReturnValue({
            ...emptyFilterState,
            isBankrupt: true,
            hasAccounting: false,
        })

        const { result } = renderHook(() => useFilterParams())

        expect(result.current.filterParams.is_bankrupt).toBe(true)
        expect(result.current.filterParams.has_accounting).toBe(false)
    })

    it('returns undefined for null boolean filters', () => {
        mockUseFilterStore.mockReturnValue({
            ...emptyFilterState,
            isBankrupt: null,
        })

        const { result } = renderHook(() => useFilterParams())

        expect(result.current.filterParams.is_bankrupt).toBeUndefined()
    })
})

describe('Sort Parameters', () => {
    it('returns sortBy and sortOrder from store', () => {
        mockUseFilterStore.mockReturnValue({
            ...emptyFilterState,
            sortBy: 'revenue',
            sortOrder: 'desc',
        })

        const { result } = renderHook(() => useFilterParams())

        expect(result.current.sortBy).toBe('revenue')
        expect(result.current.sortOrder).toBe('desc')
    })
})
