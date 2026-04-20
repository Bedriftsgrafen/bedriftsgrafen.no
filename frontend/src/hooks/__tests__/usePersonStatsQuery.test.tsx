import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePersonStatsQuery } from '../queries/usePersonStatsQuery'
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

const MOCK_STATS = {
    total_persons: 906050,
    total_active_roles: 1842630,
    avg_board_age: 53,
    role_type_distribution: [
        { type_kode: 'MEDL', type_beskrivelse: 'Styremedlem', count: 580000 },
        { type_kode: 'DAGL', type_beskrivelse: 'Daglig leder', count: 420000 },
    ],
    generation_distribution: [
        { generation: 'Gen X', birth_year_range: '1965-1980', count: 531000 },
        { generation: 'Millennials', birth_year_range: '1981-1996', count: 447000 },
    ],
}

describe('usePersonStatsQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns stats data on success', async () => {
        mockApiClient.get.mockResolvedValueOnce({ data: MOCK_STATS })

        const { result } = renderHook(() => usePersonStatsQuery(), { wrapper: createWrapper() })

        await waitFor(() => expect(result.current.isSuccess).toBe(true))

        expect(result.current.data).toEqual(MOCK_STATS)
        expect(mockApiClient.get).toHaveBeenCalledWith('/v1/people/stats')
    })

    it('handles API error', async () => {
        mockApiClient.get.mockRejectedValueOnce(new Error('Server error'))

        const { result } = renderHook(() => usePersonStatsQuery(), { wrapper: createWrapper() })

        await waitFor(() => expect(result.current.isError).toBe(true))

        expect(result.current.error).toBeDefined()
    })

    it('starts in loading state', () => {
        mockApiClient.get.mockReturnValue(new Promise(() => {}))

        const { result } = renderHook(() => usePersonStatsQuery(), { wrapper: createWrapper() })

        expect(result.current.isLoading).toBe(true)
        expect(result.current.data).toBeUndefined()
    })
})
