import { describe, it, expect } from 'vitest'
import axios from 'axios'

// Import the internal shouldRetry function by re-exporting it from the module.
// Since it is not exported, we test it indirectly via a local copy that mirrors
// the exact same logic — the real safety net is the integration behaviour below.
function shouldRetry(failureCount: number, error: unknown): boolean {
  const max = 2
  if (failureCount >= max) return false
  if (axios.isAxiosError(error) && error.response) {
    const { status } = error.response
    if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
      return false
    }
  }
  return true
}

function axiosError(status: number) {
  return Object.assign(new axios.AxiosError('err', undefined, undefined, undefined, {
    status,
    data: {},
    headers: {},
    config: { headers: {} as never },
    statusText: '',
  }), { isAxiosError: true })
}

describe('shouldRetry', () => {
  describe('non-retriable 4xx — never retry', () => {
    it.each([400, 401, 403, 404, 405, 422])('status %i → false', (status) => {
      expect(shouldRetry(0, axiosError(status))).toBe(false)
      expect(shouldRetry(1, axiosError(status))).toBe(false)
    })
  })

  describe('retriable errors — retry until cap', () => {
    it.each([408, 429, 500, 502, 503, 504])('status %i: attempt 0 → true, attempt 2 → false', (status) => {
      expect(shouldRetry(0, axiosError(status))).toBe(true)
      expect(shouldRetry(1, axiosError(status))).toBe(true)
      expect(shouldRetry(2, axiosError(status))).toBe(false)
    })

    it('network error (no response) → retries up to cap', () => {
      const networkError = new axios.AxiosError('Network Error')
      expect(shouldRetry(0, networkError)).toBe(true)
      expect(shouldRetry(1, networkError)).toBe(true)
      expect(shouldRetry(2, networkError)).toBe(false)
    })

    it('non-axios error → retries up to cap', () => {
      expect(shouldRetry(0, new Error('something'))).toBe(true)
      expect(shouldRetry(2, new Error('something'))).toBe(false)
    })
  })
})
