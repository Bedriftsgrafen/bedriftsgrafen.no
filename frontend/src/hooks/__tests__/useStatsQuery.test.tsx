import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeStatsResponse, useStatsQuery } from '../queries/useStatsQuery'
import { apiClient } from '../../utils/apiClient'

vi.mock('../../utils/apiClient', () => ({
    apiClient: {
        get: vi.fn(),
    },
}))

const mockApiClient = apiClient as unknown as { get: ReturnType<typeof vi.fn> }

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })

    return function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
}

describe('useStatsQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('normalizes aggregate stats payloads used by company stats endpoints', () => {
        expect(normalizeStatsResponse({
            total_count: '1163193',
            total_roles: 3400000,
            new_companies_30d: 1280,
        })).toMatchObject({
            total_companies: 1163193,
            total_roles: 3400000,
            new_companies_30d: 1280,
        })
    })

    it('uses the primary stats endpoint when it returns core platform data', async () => {
        mockApiClient.get.mockResolvedValueOnce({
            data: {
                total_companies: 1163193,
                total_roles: 3400000,
                new_companies_30d: 1280,
            },
        })

        const { result } = renderHook(() => useStatsQuery(), { wrapper: createWrapper() })

        await waitFor(() => {
            expect(result.current.data?.total_companies).toBe(1163193)
        })

        expect(mockApiClient.get).toHaveBeenCalledTimes(1)
        expect(mockApiClient.get).toHaveBeenCalledWith('/stats')
    })

    it('does not call the heavier company stats endpoint for invalid primary responses', async () => {
        mockApiClient.get.mockResolvedValueOnce({ data: '<!doctype html>' })

        const { result } = renderHook(() => useStatsQuery(), { wrapper: createWrapper() })

        await waitFor(() => {
            expect(result.current.data?.total_companies).toBeNull()
        })

        expect(mockApiClient.get).toHaveBeenCalledTimes(1)
        expect(mockApiClient.get).toHaveBeenCalledWith('/stats')
    })

    it('returns empty stats instead of throwing when homepage stats fail', async () => {
        mockApiClient.get.mockRejectedValueOnce(new Error('Server error'))

        const { result } = renderHook(() => useStatsQuery(), { wrapper: createWrapper() })

        await waitFor(() => {
            expect(result.current.data?.total_companies).toBeNull()
        })

        expect(result.current.isError).toBe(false)
    })
})