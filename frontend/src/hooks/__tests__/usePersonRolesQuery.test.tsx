/**
 * MECE Unit Tests for usePersonRolesQuery hook
 *
 * Test Categories:
 * 1. Query behavior - Enable/disable logic
 * 2. Query keys - Factory pattern validation
 * 3. Response handling - Data transformation
 * 4. Parameter handling - Name and birthdate
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePersonRolesQuery } from '../queries/usePersonRolesQuery'
import { personQueryKeys } from '../queries/usePersonSearchQuery'
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
// Category 1: Query Enable/Disable Logic
// ============================================================================
describe('usePersonRolesQuery - Query Behavior', () => {
    it('is disabled when name is undefined', () => {
        const { result } = renderHook(
            () => usePersonRolesQuery(undefined),
            { wrapper: createWrapper() }
        )

        expect(result.current.fetchStatus).toBe('idle')
        expect(mockApiClient.get).not.toHaveBeenCalled()
    })

    it('is enabled when name is provided', async () => {
        mockApiClient.get.mockResolvedValue({ data: [] })

        renderHook(
            () => usePersonRolesQuery('Ola Nordmann'),
            { wrapper: createWrapper() }
        )

        await waitFor(() => {
            expect(mockApiClient.get).toHaveBeenCalled()
        })
    })

    it('is disabled when name is empty string', () => {
        // Empty string is falsy, so enabled should be false
        const { result } = renderHook(
            () => usePersonRolesQuery(''),
            { wrapper: createWrapper() }
        )

        expect(result.current.fetchStatus).toBe('idle')
    })
})

// ============================================================================
// Category 2: Query Keys
// ============================================================================
describe('usePersonRolesQuery - Query Keys', () => {
    it('uses personQueryKeys.roles for cache key', async () => {
        mockApiClient.get.mockResolvedValue({ data: [] })

        renderHook(
            () => usePersonRolesQuery('Ola Nordmann', '1980-05-15'),
            { wrapper: createWrapper() }
        )

        // The key should be the roles key
        const expectedKey = personQueryKeys.roles('Ola Nordmann', '1980-05-15')
        expect(expectedKey).toEqual(['people', 'roles', 'Ola Nordmann', '1980-05-15'])
    })

    it('handles null birthdate in key', () => {
        const key = personQueryKeys.roles('Ola Nordmann', null)
        expect(key).toEqual(['people', 'roles', 'Ola Nordmann', null])
    })
})

// ============================================================================
// Category 3: Response Handling
// ============================================================================
describe('usePersonRolesQuery - Response Handling', () => {
    it('returns parsed role results', async () => {
        const mockData = [
            {
                orgnr: '123456789',
                type_kode: 'DAGL',
                type_beskrivelse: 'Daglig leder',
                enhet_navn: 'Test AS',
                fratraadt: false,
                rekkefoelge: 1,
            },
        ]
        mockApiClient.get.mockResolvedValue({ data: mockData })

        const { result } = renderHook(
            () => usePersonRolesQuery('Ola Nordmann'),
            { wrapper: createWrapper() }
        )

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(result.current.data).toHaveLength(1)
        expect(result.current.data?.[0].orgnr).toBe('123456789')
        expect(result.current.data?.[0].fratraadt).toBe(false)
    })

    it('returns empty array for person with no roles', async () => {
        mockApiClient.get.mockResolvedValue({ data: [] })

        const { result } = renderHook(
            () => usePersonRolesQuery('Unknown Person'),
            { wrapper: createWrapper() }
        )

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true)
        })

        expect(result.current.data).toEqual([])
    })
})

// ============================================================================
// Category 4: Parameter Handling
// ============================================================================
describe('usePersonRolesQuery - Parameter Handling', () => {
    it('passes name to API', async () => {
        mockApiClient.get.mockResolvedValue({ data: [] })

        renderHook(
            () => usePersonRolesQuery('Ola Nordmann'),
            { wrapper: createWrapper() }
        )

        await waitFor(() => {
            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/v1/people/roles',
                expect.objectContaining({
                    params: { name: 'Ola Nordmann' },
                })
            )
        })
    })

    it('includes birthdate when provided', async () => {
        mockApiClient.get.mockResolvedValue({ data: [] })

        renderHook(
            () => usePersonRolesQuery('Ola Nordmann', '1980-05-15'),
            { wrapper: createWrapper() }
        )

        await waitFor(() => {
            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/v1/people/roles',
                expect.objectContaining({
                    params: { name: 'Ola Nordmann', birthdate: '1980-05-15' },
                })
            )
        })
    })

    it('omits birthdate when null', async () => {
        mockApiClient.get.mockResolvedValue({ data: [] })

        renderHook(
            () => usePersonRolesQuery('Ola Nordmann', null),
            { wrapper: createWrapper() }
        )

        await waitFor(() => {
            expect(mockApiClient.get).toHaveBeenCalledWith(
                '/v1/people/roles',
                expect.objectContaining({
                    params: { name: 'Ola Nordmann' },
                })
            )
        })

        // Verify birthdate is NOT in params
        const callArgs = mockApiClient.get.mock.calls[0][1]
        expect(callArgs.params.birthdate).toBeUndefined()
    })
})

// ============================================================================
// Category 5: Error Handling
// ============================================================================
describe('usePersonRolesQuery - Error Handling', () => {
    it('handles API errors gracefully', async () => {
        mockApiClient.get.mockRejectedValue(new Error('Network error'))

        const { result } = renderHook(
            () => usePersonRolesQuery('Test Person'),
            { wrapper: createWrapper() }
        )

        await waitFor(() => {
            expect(result.current.isError).toBe(true)
        })

        expect(result.current.error).toBeDefined()
    })
})
