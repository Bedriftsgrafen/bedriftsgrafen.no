/**
 * Unit tests for useCompanyModal hook.
 *
 * Tests clipboard copying, sharing API, and toast notifications.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCompanyModal } from '../useCompanyModal'
import { useToastStore } from '../../store/toastStore'
import { copyToClipboard } from '../../utils/clipboard'

// Mock the dependencies
vi.mock('../../store/toastStore', () => ({
    useToastStore: vi.fn(),
}))

vi.mock('../../utils/clipboard', () => ({
    copyToClipboard: vi.fn(),
}))

const mockAddToast = vi.fn()
const mockUseToastStore = useToastStore as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    mockUseToastStore.mockImplementation((selector: (state: unknown) => unknown) => selector({ addToast: mockAddToast }))
})

describe('useCompanyModal', () => {
    const mockCompany = {
        orgnr: '123456789',
        navn: 'Test AS'
    }

    describe('handleCopyOrgnr', () => {
        it('sets copiedOrgnr true on success and shows toast', async () => {
            vi.mocked(copyToClipboard).mockResolvedValue(true)
            const { result } = renderHook(() => useCompanyModal())

            await act(async () => {
                await result.current.handleCopyOrgnr('123456789')
            })

            expect(result.current.copiedOrgnr).toBe(true)
            expect(mockAddToast).toHaveBeenCalledWith('success', expect.stringContaining('kopiert'))
            expect(copyToClipboard).toHaveBeenCalledWith('123456789')
        })

        it('resets copiedOrgnr after 2 seconds', async () => {
            vi.mocked(copyToClipboard).mockResolvedValue(true)
            const { result } = renderHook(() => useCompanyModal())

            await act(async () => {
                await result.current.handleCopyOrgnr('123456789')
            })

            expect(result.current.copiedOrgnr).toBe(true)

            act(() => {
                vi.advanceTimersByTime(2000)
            })

            expect(result.current.copiedOrgnr).toBe(false)
        })

        it('shows error toast on failure', async () => {
            vi.mocked(copyToClipboard).mockResolvedValue(false)
            const { result } = renderHook(() => useCompanyModal())

            await act(async () => {
                await result.current.handleCopyOrgnr('123456789')
            })

            expect(result.current.copiedOrgnr).toBe(false)
            expect(mockAddToast).toHaveBeenCalledWith('error', expect.any(String))
        })
    })

    describe('handleShare', () => {
        const originalNavigatorShare = navigator.share
        const originalLocation = window.location

        beforeEach(() => {
            // Mock navigator.share
            Object.defineProperty(navigator, 'share', {
                writable: true,
                value: vi.fn(),
            })
            // Mock window.location
            Object.defineProperty(window, 'location', {
                writable: true,
                value: { href: 'http://localhost/company/123456789' },
            })
        })

        afterEach(() => {
            navigator.share = originalNavigatorShare
            Object.defineProperty(window, 'location', {
                writable: true,
                value: originalLocation,
            })
        })

        it('uses navigator.share if available', async () => {
            const { result } = renderHook(() => useCompanyModal({ company: mockCompany }))

            await act(async () => {
                await result.current.handleShare()
            })

            expect(navigator.share).toHaveBeenCalledWith({
                title: expect.stringContaining('Test AS'),
                text: expect.stringContaining('Test AS'),
                url: 'http://localhost/company/123456789',
            })
        })

        it('falls back to clipboard copy if share is not available', async () => {
            Object.defineProperty(navigator, 'share', {
                writable: true,
                value: undefined,
            })
            vi.mocked(copyToClipboard).mockResolvedValue(true)

            const { result } = renderHook(() => useCompanyModal({ company: mockCompany }))

            await act(async () => {
                await result.current.handleShare()
            })

            expect(copyToClipboard).toHaveBeenCalledWith('http://localhost/company/123456789')
            expect(mockAddToast).toHaveBeenCalledWith('success', expect.stringContaining('Lenke kopiert'))
        })

        it('does nothing if company is not provided', async () => {
            const { result } = renderHook(() => useCompanyModal())

            await act(async () => {
                await result.current.handleShare()
            })

            expect(navigator.share).not.toHaveBeenCalled()
            expect(copyToClipboard).not.toHaveBeenCalled()
        })
    })
})
