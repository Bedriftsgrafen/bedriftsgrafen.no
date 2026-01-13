/**
 * MECE Unit Tests for usePersonSearchQuery hook
 *
 * Test Categories:
 * 1. Query behavior - Enable/disable logic
 * 2. Query keys - Factory pattern validation
 * 3. Response handling - Data transformation
 * 4. Error handling - Graceful degradation
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePersonSearchQuery, personQueryKeys } from '../queries/usePersonSearchQuery'
import { apiClient } from '../../utils/apiClient'
import type { ReactNode } from 'react'

// Mock apiClient
vi.mock('../../utils/apiClient', () => ({
    apiClient: {
        get: vi.fn(),
    },
}))

const mockApiClient = apiClient as unknown as { get: ReturnType<typeof vi.fn> }

// Test wrapper
function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
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

beforeEach(() => {
    vi.clearAllMocks()
})

// ============================================================================
// Category 1: Query Keys Factory
// ============================================================================
describe('personQueryKeys', () => {
    it('creates base key array', () => {
        expect(personQueryKeys.all).toEqual(['people'])
    })

    it('creates search key with query', () => {
        const key = personQueryKeys.search('Ola')
        expect(key).toEqual(['people', 'search', 'Ola'])
    })

    it('creates roles key with name and birthdate', () => {
        const key = personQueryKeys.roles('Ola Nordmann', '1980-05-15')
        expect(key).toEqual(['people', 'roles', 'Ola Nordmann', '1980-05-15'])
    })

    it('creates roles key with null birthdate', () => {
        const key = personQueryKeys.roles('Ola Nordmann', null)
        expect(key).toEqual(['people', 'roles', 'Ola Nordmann', null])
    })
})

// ============================================================================
// Category 2: Query Enable/Disable Logic
// ============================================================================
describe('usePersonSearchQuery - Query Behavior', () => {
    it('is disabled for queries shorter than 3 characters', () => {
        const { result } = renderHook(
            () => usePersonSearchQuery('Ol'),
            { wrapper: createWrapper() }
        )

        expect(result.current.fetchStatus).toBe('idle')
        expect(mockApiClient.get).not.toHaveBeenCalled()
    })

    it('is enabled for queries of 3+ characters', async () => {
        mockApiClient.get.mockResolvedValue({ data: [] })

        const { result } = renderHook(
            () => usePersonSearchQuery('Ola'),
            { wrapper: createWrapper() }
        )

        await waitFor(() => {
            expect(mockApiClient.get).toHaveBeenCalled()
            expect(result.current.data).toBeDefined()
        })
    })

    it('returns empty array for short queries immediately', async () => {
        const { result } = renderHook(
            () => usePersonSearchQuery('Ol'),
            { wrapper: createWrapper() }
        )

        // placeholderData should provide empty array
        expect(result.current.data).toEqual([])
    })
})

// ============================================================================
// Category 3: Response Handling
// ============================================================================
describe('usePersonSearchQuery - Response Handling', () => {
    it('returns parsed person results', async () => {
        const mockData = [
            { name: 'Ola Nordmann', birthdate: '1980-05-15', role_count: 3 },
            { name: 'Kari Nordmann', birthdate: null, role_count: 1 },
        ]
        mockApiClient.get.mockResolvedValue({ data: mockData })

        const { result } = renderHook(
            () => usePersonSearchQuery('Nordmann'),
            { wrapper: createWrapper() }
        )

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
            expect(result.current.data).toHaveLength(2)
        })

        expect(result.current.data?.[0].name).toBe('Ola Nordmann')
        expect(result.current.data?.[1].birthdate).toBeNull()
    })

    it('passes limit parameter to API', async () => {
        mockApiClient.get.mockResolvedValue({ data: [] })

        renderHook(
            () => usePersonSearchQuery('Test', 25),
            { wrapper: createWrapper() }
        )

        await waitFor(() => {
            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/v1/people/search',
                expect.objectContaining({
                    params: { q: 'Test', limit: 25 },
                })
            )
        })
    })
})

// ============================================================================
// Category 4: Error Handling
// ============================================================================
describe('usePersonSearchQuery - Error Handling', () => {
    it('handles API errors gracefully', async () => {
        mockApiClient.get.mockRejectedValue(new Error('Network error'))

        const { result } = renderHook(
            () => usePersonSearchQuery('Test'),
            { wrapper: createWrapper() }
        )

        await waitFor(() => {
            expect(result.current.isError).toBe(true)
        })

        expect(result.current.error).toBeDefined()
    })
})
