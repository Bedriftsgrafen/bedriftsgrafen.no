import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCompanySearchQuery } from '../queries/useCompanySearchQuery'
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

describe('useCompanySearchQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not query for broad two-character text searches', () => {
        const { result } = renderHook(() => useCompanySearchQuery('as'), { wrapper: createWrapper() })

        expect(result.current.fetchStatus).toBe('idle')
        expect(result.current.data).toEqual([])
        expect(mockApiClient.get).not.toHaveBeenCalled()
    })

    it('normalizes and queries valid company searches', async () => {
        mockApiClient.get.mockResolvedValue({ data: [] })

        renderHook(() => useCompanySearchQuery('  Equinor  ', 5), { wrapper: createWrapper() })

        await waitFor(() => {
            expect(mockApiClient.get).toHaveBeenCalledWith('/v1/companies/search', {
                params: { name: 'Equinor', limit: 5 },
            })
        })
    })
})