import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../utils/apiClient'
import { useCompanyEventsQuery } from '../queries/useCompanyEventsQuery'

const { mockIsAutomatedClient } = vi.hoisted(() => ({
  mockIsAutomatedClient: vi.fn(),
}))

vi.mock('../../utils/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}))

vi.mock('../../utils/automatedClient', () => ({
  isAutomatedClient: mockIsAutomatedClient,
}))

const mockApiClient = apiClient as unknown as { get: ReturnType<typeof vi.fn> }

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

describe('useCompanyEventsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not load dynamic events for automated clients', () => {
    mockIsAutomatedClient.mockReturnValue(true)

    const { result } = renderHook(() => useCompanyEventsQuery('123456789'), {
      wrapper: createWrapper(),
    })

    expect(result.current.fetchStatus).toBe('idle')
    expect(mockApiClient.get).not.toHaveBeenCalled()
  })

  it('loads dynamic events for interactive clients', async () => {
    mockIsAutomatedClient.mockReturnValue(false)
    mockApiClient.get.mockResolvedValue({
      data: {
        generated_at: '2026-08-22T12:00:00Z',
        cache_ttl_seconds: 300,
        orgnr: '123456789',
        limit: 6,
        offset: 0,
        has_more: false,
        events: [],
      },
    })

    renderHook(() => useCompanyEventsQuery('123456789'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(mockApiClient.get).toHaveBeenCalledWith('/v1/activity/events/123456789', {
        params: { limit: 6, offset: 0 },
      })
    })
  })
})
