/**
 * Unit tests for toastStore.
 *
 * Tests toast add/remove, deduplication, helpers, and error parsing.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useToastStore, toast, getErrorMessage } from '../toastStore'

// Mock setTimeout/clearTimeout for testing auto-remove
vi.useFakeTimers()

// Reset store before each test
beforeEach(() => {
    useToastStore.setState({ toasts: [] })
})

describe('ToastStore Initial State', () => {
    it('should start with empty toasts array', () => {
        expect(useToastStore.getState().toasts).toEqual([])
    })
})

describe('Add Toast', () => {
    it('addToast should add toast with id and type', () => {
        useToastStore.getState().addToast('success', 'Test message')

        const toasts = useToastStore.getState().toasts
        expect(toasts).toHaveLength(1)
        expect(toasts[0].type).toBe('success')
        expect(toasts[0].message).toBe('Test message')
        expect(toasts[0].id).toBeDefined()
    })

    it('addToast should not add duplicate messages', () => {
        useToastStore.getState().addToast('info', 'Same message')
        useToastStore.getState().addToast('info', 'Same message')

        expect(useToastStore.getState().toasts).toHaveLength(1)
    })

    it('addToast allows same message with different type', () => {
        useToastStore.getState().addToast('success', 'Message')
        useToastStore.getState().addToast('error', 'Message')

        expect(useToastStore.getState().toasts).toHaveLength(2)
    })

    it('addToast should auto-remove after duration', () => {
        useToastStore.getState().addToast('info', 'Auto remove', 3000)

        expect(useToastStore.getState().toasts).toHaveLength(1)

        // Fast-forward time
        vi.advanceTimersByTime(3000)

        expect(useToastStore.getState().toasts).toHaveLength(0)
    })
})

describe('Remove Toast', () => {
    it('removeToast should remove by id', () => {
        useToastStore.getState().addToast('success', 'First')
        useToastStore.getState().addToast('info', 'Second')

        const firstId = useToastStore.getState().toasts[0].id
        useToastStore.getState().removeToast(firstId)

        const toasts = useToastStore.getState().toasts
        expect(toasts).toHaveLength(1)
        expect(toasts[0].message).toBe('Second')
    })

    it('removeToast handles non-existent id gracefully', () => {
        useToastStore.getState().addToast('info', 'Test')
        useToastStore.getState().removeToast('fake-id')

        expect(useToastStore.getState().toasts).toHaveLength(1)
    })
})

describe('Toast Helper Functions', () => {
    it('toast.success adds success toast', () => {
        toast.success('Success!')
        expect(useToastStore.getState().toasts[0].type).toBe('success')
    })

    it('toast.error adds error toast', () => {
        toast.error('Error!')
        expect(useToastStore.getState().toasts[0].type).toBe('error')
    })

    it('toast.warning adds warning toast', () => {
        toast.warning('Warning!')
        expect(useToastStore.getState().toasts[0].type).toBe('warning')
    })

    it('toast.info adds info toast', () => {
        toast.info('Info!')
        expect(useToastStore.getState().toasts[0].type).toBe('info')
    })
})

describe('getErrorMessage', () => {
    // Mock axios.isAxiosError for all tests in this describe block
    vi.mock('axios', () => ({
        default: {
            isAxiosError: (e: unknown) => (e as { isAxiosError?: boolean })?.isAxiosError === true,
        },
        isAxiosError: (e: unknown) => (e as { isAxiosError?: boolean })?.isAxiosError === true,
    }))

    it('returns generic message for non-axios errors', () => {
        const result = getErrorMessage(new Error('Random error'))
        expect(result).toContain('gikk galt')
    })

    it('returns generic message for null/undefined', () => {
        expect(getErrorMessage(null)).toContain('gikk galt')
        expect(getErrorMessage(undefined)).toContain('gikk galt')
    })

    it('returns timeout message for timeout errors', () => {
        const error = {
            isAxiosError: true,
            code: 'ECONNABORTED',
            message: 'timeout',
            response: undefined,
        }

        const result = getErrorMessage(error)
        expect(result).toContain('lang tid')
    })

    it('returns network error message when no response', () => {
        const error = {
            isAxiosError: true,
            message: 'Network Error',
            response: undefined,
        }

        const result = getErrorMessage(error)
        expect(result).toContain('koble til') // Norwegian for "connect to"
    })

    it('returns 404 message for not found', () => {
        const error = {
            isAxiosError: true,
            message: 'Not Found',
            response: { status: 404, data: {} },
        }

        const result = getErrorMessage(error)
        expect(result).toContain('ikke funnet')
    })

    it('returns rate limit message for 429', () => {
        const error = {
            isAxiosError: true,
            message: 'Too Many Requests',
            response: { status: 429, data: {} },
        }

        const result = getErrorMessage(error)
        expect(result).toContain('mange')
    })

    it('returns server error message for 5xx', () => {
        const error = {
            isAxiosError: true,
            message: 'Internal Server Error',
            response: { status: 500, data: {} },
        }

        const result = getErrorMessage(error)
        expect(result).toContain('Serverfeil')
    })

    it('returns detail from response if available', () => {
        const error = {
            isAxiosError: true,
            message: 'Bad Request',
            response: { status: 400, data: { detail: 'Custom error message' } },
        }

        const result = getErrorMessage(error)
        expect(result).toBe('Custom error message')
    })

    it('returns generic message for unknown errors', () => {
        const result = getErrorMessage(new Error('Random error'))
        expect(result).toContain('gikk galt')
    })
})
