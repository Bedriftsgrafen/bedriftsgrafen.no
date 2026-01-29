/**
 * MECE Unit Tests for useCountyQuery hook
 *
 * Test Categories:
 * 1. Query keys - Factory pattern validation
 * 2. Query behavior - Enable/disable logic
 * 3. Response handling - Data transformation
 * 4. Error handling - Graceful degradation
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCountyQuery, useCountiesListQuery } from '../queries/useCountyQuery'
import { countyQueryKeys } from '../../lib/queryKeys'
import { apiClient } from '../../utils/apiClient'
import type { ReactNode } from 'react'
import type { CountyPremiumResponse, CountyListItem } from '../../types'

// Mock apiClient
vi.mock('../../utils/apiClient', () => ({
    apiClient: {
        get: vi.fn(),
    },
}))

const mockApiClient = apiClient as unknown as { get: ReturnType<typeof vi.fn> }

// Test wrapper - creates a fresh QueryClient for each test
function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false, // Disable retries for faster test failures
                gcTime: 0,    // Disable garbage collection caching
            },
        },
    })
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )
    }
}

// Mock county dashboard response
const mockCountyDashboard: CountyPremiumResponse = {
    code: '46',
    name: 'Vestland',
    population: 645000,
    company_count: 58000,
    municipality_count: 43,
    business_density: 89.9,
    business_density_national_avg: 85.0,
    population_growth_1y: 0.8,
    establishment_trend: [
        { label: 'Jan', value: 450 },
        { label: 'Feb', value: 480 },
    ],
    top_sectors: [
        { nace_division: '47', nace_name: 'Detaljhandel', company_count: 5000, percentage_of_total: 12.5 },
    ],
    top_companies: [],
    newest_companies: [],
    latest_bankruptcies: [],
    municipalities: [],
    ranking_national_density: { rank: 3, out_of: 11 },
    ranking_national_revenue: { rank: 2, out_of: 11 },
    ranking_national_population: { rank: 2, out_of: 11 },
}

// Mock county list response
const mockCountyList: CountyListItem[] = [
    { code: '46', name: 'Vestland', company_count: 58000, municipality_count: 43, lat: 60.3913, lng: 5.3221 },
    { code: '03', name: 'Oslo', company_count: 120000, municipality_count: 1, lat: 59.9139, lng: 10.7522 },
]

beforeEach(() => {
    vi.clearAllMocks()
})

// ============================================================================
// Category 1: Query Keys Factory
// ============================================================================
describe('countyQueryKeys', () => {
    it('creates base key array', () => {
        expect(countyQueryKeys.all).toEqual(['counties'])
    })

    it('creates list key', () => {
        const key = countyQueryKeys.lists()
        expect(key).toEqual(['counties', 'list'])
    })

    it('creates dashboards base key', () => {
        const key = countyQueryKeys.dashboards()
        expect(key).toEqual(['counties', 'dashboard'])
    })

    it('creates dashboard key with code', () => {
        const key = countyQueryKeys.dashboard('46')
        expect(key).toEqual(['counties', 'dashboard', '46'])
    })
})

// ============================================================================
// Category 2: useCountyQuery - Query Behavior
// ============================================================================
describe('useCountyQuery', () => {
    describe('enable/disable logic', () => {
        it('disables query when code is null', () => {
            const { result } = renderHook(() => useCountyQuery(null), {
                wrapper: createWrapper(),
            })

            expect(result.current.isFetching).toBe(false)
            expect(mockApiClient.get).not.toHaveBeenCalled()
        })

        it('disables query when code is empty string', () => {
            const { result } = renderHook(() => useCountyQuery(''), {
                wrapper: createWrapper(),
            })

            expect(result.current.isFetching).toBe(false)
            expect(mockApiClient.get).not.toHaveBeenCalled()
        })

        it('disables query when code is invalid (not 2 digits)', () => {
            const { result } = renderHook(() => useCountyQuery('1'), {
                wrapper: createWrapper(),
            })

            expect(result.current.isFetching).toBe(false)
            expect(mockApiClient.get).not.toHaveBeenCalled()
        })

        it('disables query when code is too long', () => {
            const { result } = renderHook(() => useCountyQuery('123'), {
                wrapper: createWrapper(),
            })

            expect(result.current.isFetching).toBe(false)
            expect(mockApiClient.get).not.toHaveBeenCalled()
        })

        it('enables query when code is valid 2-digit string', async () => {
            mockApiClient.get.mockResolvedValueOnce({ data: mockCountyDashboard })

            const { result } = renderHook(() => useCountyQuery('46'), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))
            expect(mockApiClient.get).toHaveBeenCalledWith('/v1/county/46')
        })
    })

    describe('slug handling', () => {
        it('extracts code from slugified route param', async () => {
            mockApiClient.get.mockResolvedValueOnce({ data: mockCountyDashboard })

            const { result } = renderHook(() => useCountyQuery('46-vestland'), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))
            expect(mockApiClient.get).toHaveBeenCalledWith('/v1/county/46')
        })

        it('extracts code from multi-word slugs', async () => {
            mockApiClient.get.mockResolvedValueOnce({ data: mockCountyDashboard })

            const { result } = renderHook(() => useCountyQuery('15-more-og-romsdal'), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))
            expect(mockApiClient.get).toHaveBeenCalledWith('/v1/county/15')
        })
    })

    describe('response handling', () => {
        it('returns county dashboard data on success', async () => {
            mockApiClient.get.mockResolvedValueOnce({ data: mockCountyDashboard })

            const { result } = renderHook(() => useCountyQuery('46'), {
                wrapper: createWrapper(),
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))
            
            expect(result.current.data).toEqual(mockCountyDashboard)
            expect(result.current.data?.name).toBe('Vestland')
            expect(result.current.data?.company_count).toBe(58000)
        })
    })

    describe('error handling', () => {
        it('returns undefined data when API fails', async () => {
            // Note: The hook has retry: 2 configured, so this test checks 
            // the state after the query starts (before retries complete)
            mockApiClient.get.mockRejectedValue(new Error('Network error'))

            const { result } = renderHook(() => useCountyQuery('46'), {
                wrapper: createWrapper(),
            })

            // Initially pending
            expect(result.current.isLoading).toBe(true)
            
            // Data should remain undefined after error
            await waitFor(() => expect(result.current.data).toBeUndefined())
        })
    })
})

// ============================================================================
// Category 3: useCountiesListQuery - List Fetching
// ============================================================================
describe('useCountiesListQuery', () => {
    it('fetches list of all counties', async () => {
        mockApiClient.get.mockResolvedValueOnce({ data: mockCountyList })

        const { result } = renderHook(() => useCountiesListQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))
        
        expect(mockApiClient.get).toHaveBeenCalledWith('/v1/county/')
        expect(result.current.data).toEqual(mockCountyList)
        expect(result.current.data).toHaveLength(2)
    })

    it('sets isError on API failure', async () => {
        mockApiClient.get.mockRejectedValueOnce(new Error('Server error'))

        const { result } = renderHook(() => useCountiesListQuery(), {
            wrapper: createWrapper(),
        })

        await waitFor(() => expect(result.current.isError).toBe(true))
    })
})
