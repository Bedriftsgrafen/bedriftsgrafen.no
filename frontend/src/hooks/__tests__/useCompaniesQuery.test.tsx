import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCompaniesQuery } from '../queries/useCompaniesQuery'
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

describe('useCompaniesQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('does not query companies for broad two-character text searches', () => {
        const { result } = renderHook(() => useCompaniesQuery({ name: 'as' }), { wrapper: createWrapper() })

        expect(result.current.fetchStatus).toBe('idle')
        expect(mockApiClient.get).not.toHaveBeenCalled()
    })

    it('queries companies for valid text searches', async () => {
        mockApiClient.get.mockResolvedValue({ data: [] })

        renderHook(() => useCompaniesQuery({ name: 'ask', limit: 20, skip: 0 }), { wrapper: createWrapper() })

        await waitFor(() => {
            expect(mockApiClient.get).toHaveBeenCalledWith('/v1/companies', {
                params: { skip: 0, limit: 20, name: 'ask' },
            })
        })
    })
})