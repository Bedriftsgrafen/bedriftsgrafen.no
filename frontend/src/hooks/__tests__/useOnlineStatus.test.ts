import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { useOnlineStatus } from '../useOnlineStatus'

describe('useOnlineStatus', () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine')

  function setOnLine(value: boolean) {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => value,
    })
  }

  afterEach(() => {
    // Restore original descriptor
    if (originalOnLine) {
      Object.defineProperty(navigator, 'onLine', originalOnLine)
    }
  })

  it('returns true when navigator.onLine is true', () => {
    setOnLine(true)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)
  })

  it('returns false when navigator.onLine is false', () => {
    setOnLine(false)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)
  })

  it('updates to false when offline event fires', () => {
    setOnLine(true)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)

    act(() => {
      setOnLine(false)
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current).toBe(false)
  })

  it('updates to true when online event fires', () => {
    setOnLine(false)
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)

    act(() => {
      setOnLine(true)
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current).toBe(true)
  })

  it('removes event listeners on unmount', () => {
    setOnLine(true)
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useOnlineStatus())
    unmount()

    const addedOnline = addSpy.mock.calls.filter(([event]) => event === 'online')
    const removedOnline = removeSpy.mock.calls.filter(([event]) => event === 'online')
    expect(addedOnline.length).toBe(removedOnline.length)

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
