/**
 * MECE Unit Tests for usePersonSearchResultsQuery hook
 *
 * Test Categories:
 * 1. Query keys - Verify key factory includes offset/limit
 * 2. Query behavior - Enable/disable logic
 * 3. Response handling - Data transformation
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePersonSearchResultsQuery } from '../queries/usePersonSearchResultsQuery'
import { personQueryKeys } from '../queries/usePersonSearchQuery'
import { apiClient } from '../../utils/apiClient'
import type { ReactNode } from 'react'

vi.mock('../../utils/apiClient', () => ({
    apiClient: {
        get: vi.fn(),
    },
}))

const mockApiClient = apiClient as unknown as { get: ReturnType<typeof vi.fn> }

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )
    }
}

beforeEach(() => {
    vi.clearAllMocks()
})

// ============================================================================
// Category 1: Query Keys
// ============================================================================
describe('personQueryKeys.searchResults', () => {
    it('creates key with query, offset, and limit', () => {
        const key = personQueryKeys.searchResults('Ola', 0, 20)
        expect(key).toEqual(['people', 'searchResults', 'Ola', 0, 20])
    })

    it('different offset produces different key', () => {
        const key1 = personQueryKeys.searchResults('Ola', 0, 20)
        const key2 = personQueryKeys.searchResults('Ola', 20, 20)
        expect(key1).not.toEqual(key2)
    })
})

// ============================================================================
// Category 2: Query Behavior
// ============================================================================
describe('usePersonSearchResultsQuery - Enable/Disable', () => {
    it('is disabled for queries shorter than 3 characters', () => {
        const { result } = renderHook(
            () => usePersonSearchResultsQuery('Ol', 0, 20),
            { wrapper: createWrapper() }
        )

        expect(result.current.fetchStatus).toBe('idle')
        expect(mockApiClient.get).not.toHaveBeenCalled()
    })

    it('is enabled for queries of 3+ characters', async () => {
        mockApiClient.get.mockResolvedValue({
            data: { results: [], total_count: 0, query: 'Ola' },
        })

        const { result } = renderHook(
            () => usePersonSearchResultsQuery('Ola', 0, 20),
            { wrapper: createWrapper() }
        )

        await waitFor(() => {
            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/v1/people/search/results',
                { params: { q: 'Ola', offset: 0, limit: 20 } }
            )
            expect(result.current.data).toBeDefined()
        })
    })
})

// ============================================================================
// Category 3: Response Handling
// ============================================================================
describe('usePersonSearchResultsQuery - Response', () => {
    it('returns paginated data with results and total_count', async () => {
        const mockData = {
            results: [
                {
                    name: 'Ola Nordmann',
                    birthdate: '1980-05-15',
                    role_count: 5,
                    active_role_count: 3,
                    top_roles: ['Daglig leder (2)'],
                    notable_companies: ['Equinor ASA'],
                },
            ],
            total_count: 1,
            query: 'Ola',
        }
        mockApiClient.get.mockResolvedValue({ data: mockData })

        const { result } = renderHook(
            () => usePersonSearchResultsQuery('Ola', 0, 20),
            { wrapper: createWrapper() }
        )

        await waitFor(() => {
            expect(result.current.data).toBeDefined()
            expect(result.current.data?.results).toHaveLength(1)
            expect(result.current.data?.total_count).toBe(1)
            expect(result.current.data?.results[0].name).toBe('Ola Nordmann')
        })
    })

    it('handles API error gracefully', async () => {
        mockApiClient.get.mockRejectedValue(new Error('Network error'))

        const { result } = renderHook(
            () => usePersonSearchResultsQuery('Ola', 0, 20),
            { wrapper: createWrapper() }
        )

        await waitFor(() => {
            expect(result.current.isError).toBe(true)
        })
    })
})
