import { render, screen, act, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ToastContainer } from '../Toast'
import { useToastStore } from '../../store/toastStore'

// Reset store between tests
beforeEach(() => {
  useToastStore.setState({ toasts: [] })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ToastContainer', () => {
  it('renders aria-live="polite" on container', () => {
    const { container } = render(<ToastContainer />)
    const el = container.firstChild as HTMLElement
    expect(el).toHaveAttribute('aria-live', 'polite')
    expect(el).toHaveAttribute('aria-atomic', 'false')
  })

  it('renders no toasts when store is empty', () => {
    render(<ToastContainer />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('ToastItem roles', () => {
  it('gives error toast role="alert"', () => {
    act(() => useToastStore.getState().addToast('error', 'Something failed'))
    render(<ToastContainer />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('gives warning toast role="alert"', () => {
    act(() => useToastStore.getState().addToast('warning', 'Watch out'))
    render(<ToastContainer />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('gives success toast role="status"', () => {
    act(() => useToastStore.getState().addToast('success', 'Done'))
    render(<ToastContainer />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('gives info toast role="status"', () => {
    act(() => useToastStore.getState().addToast('info', 'Loading...'))
    render(<ToastContainer />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})

describe('ToastItem auto-dismiss', () => {
  it('removes toast after duration elapses', () => {
    act(() => useToastStore.getState().addToast('info', 'Bye', 3000))
    render(<ToastContainer />)
    expect(screen.getByRole('status')).toBeInTheDocument()

    act(() => vi.advanceTimersByTime(3000))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('pauses auto-dismiss on mouse enter and resumes on mouse leave', () => {
    act(() => useToastStore.getState().addToast('info', 'Hover me', 3000))
    render(<ToastContainer />)
    const toast = screen.getByRole('status')

    // Hover — timer should pause
    fireEvent.mouseEnter(toast)
    act(() => vi.advanceTimersByTime(3000))
    // Still present because timer was paused
    expect(screen.getByRole('status')).toBeInTheDocument()

    // Unhover — remaining time resumes
    fireEvent.mouseLeave(toast)
    act(() => vi.advanceTimersByTime(3000))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('dismisses toast on Escape key', () => {
    act(() => useToastStore.getState().addToast('error', 'Press Esc'))
    render(<ToastContainer />)
    const toast = screen.getByRole('alert')

    fireEvent.keyDown(toast, { key: 'Escape' })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('ToastItem close button', () => {
  it('closes toast when close button is clicked', () => {
    act(() => useToastStore.getState().addToast('success', 'Click X'))
    render(<ToastContainer />)

    const closeBtn = screen.getByRole('button', { name: 'Lukk varsel' })
    fireEvent.click(closeBtn)
    expect(screen.queryByRole('status')).toBeNull()
  })
})
