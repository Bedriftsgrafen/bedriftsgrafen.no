import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../../utils/apiClient'
import { useCompanyDetailQuery } from '../queries/useCompanyDetailQuery'

const { mockIsAutomatedClient } = vi.hoisted(() => ({
  mockIsAutomatedClient: vi.fn(),
}))

vi.mock('../../utils/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('../../utils/automatedClient', () => ({
  isAutomatedClient: mockIsAutomatedClient,
}))

const mockApiClient = apiClient as unknown as {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
}

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

describe('useCompanyDetailQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    mockApiClient.get.mockResolvedValue({ data: { regnskap: [] } })
    mockApiClient.post.mockResolvedValue({ data: { company_fetched: true, financials_fetched: 1, errors: [] } })
  })

  it('does not auto-fetch missing accounting data for automated clients', async () => {
    mockIsAutomatedClient.mockReturnValue(true)

    const { result } = renderHook(() => useCompanyDetailQuery('123456789'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(mockApiClient.post).not.toHaveBeenCalled()
    expect(sessionStorage.getItem('auto-fetched-123456789')).toBeNull()
  })

  it('auto-fetches missing accounting data once for interactive clients', async () => {
    mockIsAutomatedClient.mockReturnValue(false)

    renderHook(() => useCompanyDetailQuery('123456789'), {
      wrapper: createWrapper(),
    })

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/v1/companies/123456789/fetch', {
        fetch_financials: true,
      })
    })

    expect(mockApiClient.post).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem('auto-fetched-123456789')).toBe('true')
  })
})
