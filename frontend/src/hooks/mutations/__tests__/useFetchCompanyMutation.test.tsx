import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query'
import axios from 'axios'
import type { ReactNode } from 'react'
import { useFetchCompanyMutation } from '../useFetchCompanyMutation'

// ── Hoisted mocks (vi.mock factories run before module-level declarations) ───

const { mockAddToast, mockPost, mockGetResponseRequestId } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
  mockPost: vi.fn(),
  mockGetResponseRequestId: vi.fn(),
}))

vi.mock('../../../utils/apiClient', () => ({
  apiClient: { post: mockPost },
  getResponseRequestId: mockGetResponseRequestId,
}))

vi.mock('../../../store/toastStore', () => ({
  useToastStore: vi.fn(() => ({ addToast: mockAddToast })),
  getErrorMessage: vi.fn(() => 'global error message'),
  withRequestReference: vi.fn((message: string, requestId?: string) => requestId ? `${message} Referanse: ${requestId}.` : message),
  toast: { error: vi.fn() },
}))

// ── Wrapper ───────────────────────────────────────────────────────────────────

const mockGlobalToast = vi.fn()

/**
 * Creates a QueryClient whose global mutationCache.onError fires mockGlobalToast,
 * mirroring the real queryClient.ts behaviour.
 */
function createWrapper() {
  const qc = new QueryClient({
    mutationCache: new MutationCache({
      onError: (_error, _vars, _ctx, mutation) => {
        if (mutation.meta?.showErrorToast === false) return
        mockGlobalToast('global toast fired')
      },
    }),
    defaultOptions: { mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockGetResponseRequestId.mockReturnValue(undefined)
})

describe('useFetchCompanyMutation error handling', () => {
  it('shows exactly one toast on AxiosError — local handler fires, global is suppressed', async () => {
    const axiosErr = Object.assign(new axios.AxiosError('fail', undefined, undefined, undefined, {
      status: 502,
      data: { detail: 'Tjenesten er utilgjengelig' },
      headers: {},
      config: { headers: {} as never },
      statusText: 'Bad Gateway',
    }), { isAxiosError: true })

    mockPost.mockRejectedValueOnce(axiosErr)

    const { result } = renderHook(() => useFetchCompanyMutation(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.mutate({ orgnr: '123456789' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    // Local addToast called exactly once with 'error' type (the onMutate 'info' is expected)
    const errorCalls = (mockAddToast.mock.calls as [string, ...unknown[]][]).filter(([type]) => type === 'error')
    expect(errorCalls).toHaveLength(1)
    expect(errorCalls[0]).toEqual(['error', 'global error message'])

    // Global handler must NOT fire (meta.showErrorToast === false)
    expect(mockGlobalToast).not.toHaveBeenCalled()
  })

  it('shows fallback message when AxiosError has no response detail', async () => {
    const networkErr = new axios.AxiosError('Network Error')
    mockPost.mockRejectedValueOnce(networkErr)

    const { result } = renderHook(() => useFetchCompanyMutation(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.mutate({ orgnr: '987654321' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    const errorCalls = (mockAddToast.mock.calls as [string, ...unknown[]][]).filter(([type]) => type === 'error')
    expect(errorCalls).toHaveLength(1)
    expect(errorCalls[0]).toEqual(['error', 'global error message'])
    expect(mockGlobalToast).not.toHaveBeenCalled()
  })

  it('shows fallback message for non-axios errors', async () => {
    mockPost.mockRejectedValueOnce(new Error('unexpected'))

    const { result } = renderHook(() => useFetchCompanyMutation(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.mutate({ orgnr: '111111111' })
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    const errorCalls = (mockAddToast.mock.calls as [string, ...unknown[]][]).filter(([type]) => type === 'error')
    expect(errorCalls).toHaveLength(1)
    expect(errorCalls[0]).toEqual(['error', 'global error message'])
    expect(mockGlobalToast).not.toHaveBeenCalled()
  })

  it('uses stable Brreg code and request reference for successful fetch payload errors', async () => {
    mockGetResponseRequestId.mockReturnValueOnce('abc12345')
    mockPost.mockResolvedValueOnce({
      data: {
        company_fetched: false,
        financials_fetched: 0,
        error_code: 'BRREG_API_ERROR',
        errors: ['Kunne ikke hente data fra Brønnøysundregistrene akkurat nå.'],
      },
      headers: { 'x-request-id': 'abc12345' },
    })

    const { result } = renderHook(() => useFetchCompanyMutation(), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.mutate({ orgnr: '123456789' })
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const errorCalls = (mockAddToast.mock.calls as [string, ...unknown[]][]).filter(([type]) => type === 'error')
    expect(errorCalls).toHaveLength(1)
    expect(errorCalls[0]).toEqual([
      'error',
      'Kunne ikke hente data fra Brønnøysundregistrene. Prøv igjen. Referanse: abc12345.',
    ])
  })
})
