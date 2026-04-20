import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePersonToplistsQuery } from '../queries/usePersonToplistsQuery'
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

const MOCK_TOPLISTS = [
    {
        category: 'active_roles',
        entries: [
            { rank: 1, name: 'Ola Nordmann', birth_year: 1970, value: 120, active_roles: 120, active_companies: 45 },
        ],
    },
    {
        category: 'LEDE',
        entries: [
            { rank: 1, name: 'Trude Moen', birth_year: 1972, value: 50, active_roles: 80, active_companies: 50 },
        ],
    },
]

describe('usePersonToplistsQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns toplist data on success', async () => {
        mockApiClient.get.mockResolvedValueOnce({ data: MOCK_TOPLISTS })

        const { result } = renderHook(() => usePersonToplistsQuery(), { wrapper: createWrapper() })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data).toEqual(MOCK_TOPLISTS)
        expect(mockApiClient.get).toHaveBeenCalledWith('/v1/people/toplists', { params: { limit: 10 } })
    })

    it('passes custom limit parameter', async () => {
        mockApiClient.get.mockResolvedValueOnce({ data: MOCK_TOPLISTS })

        const { result } = renderHook(() => usePersonToplistsQuery(5), { wrapper: createWrapper() })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(mockApiClient.get).toHaveBeenCalledWith('/v1/people/toplists', { params: { limit: 5 } })
    })

    it('handles API error', async () => {
        mockApiClient.get.mockRejectedValueOnce(new Error('Network error'))

        const { result } = renderHook(() => usePersonToplistsQuery(), { wrapper: createWrapper() })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error).toBeDefined()
    })

    it('starts in loading state', () => {
        mockApiClient.get.mockReturnValue(new Promise(() => {}))

        const { result } = renderHook(() => usePersonToplistsQuery(), { wrapper: createWrapper() })

        expect(result.current.isLoading).toBe(true)
        expect(result.current.data).toBeUndefined()
    })
})
