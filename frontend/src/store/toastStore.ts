import { create } from 'zustand'
import axios from 'axios'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastStore {
  toasts: Toast[]
  addToast: (type: ToastType, message: string, duration?: number) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  addToast: (type, message, duration = 5000) => {
    // Deduplicate: Don't add if same message already exists
    const existingToast = get().toasts.find(t => t.message === message && t.type === type)
    if (existingToast) return

    const id = Math.random().toString(36).substring(7)
    set((state) => ({
      toasts: [...state.toasts, { id, type, message }],
    }))
    // Auto-remove after duration
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }))
    }, duration)
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))

// Helper functions for common toast scenarios
export const toast = {
  success: (message: string) => useToastStore.getState().addToast('success', message),
  error: (message: string) => useToastStore.getState().addToast('error', message, 8000),
  warning: (message: string) => useToastStore.getState().addToast('warning', message, 6000),
  info: (message: string) => useToastStore.getState().addToast('info', message),
}

// Parse API errors into user-friendly messages
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    // Timeout
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return 'Forespørselen tok for lang tid. Prøv igjen.'
    }
    // Network error (no response)
    if (!error.response) {
      return 'Kunne ikke koble til serveren. Sjekk internettforbindelsen.'
    }
    // Server errors
    const status = error.response.status
    if (status === 404) {
      return 'Ressursen ble ikke funnet.'
    }
    if (status === 429) {
      return 'For mange forespørsler. Vent litt og prøv igjen.'
    }
    if (status >= 500) {
      return 'Serverfeil. Prøv igjen senere.'
    }
    // Handle FastAPI validation errors (422) - detail is an array
    if (status === 422 && error.response.data) {
      const data = error.response.data
      // FastAPI returns { detail: [{loc: [...], msg: string, type: string}, ...] }
      if (Array.isArray(data.detail) && data.detail.length > 0) {
        const firstError = data.detail[0]
        if (firstError.msg && typeof firstError.msg === 'string') {
          return `Valideringsfeil: ${firstError.msg}`
        }
      }
      // Simple string detail
      if (typeof data.detail === 'string') {
        return data.detail
      }
      return 'Ugyldig forespørsel. Sjekk parametrene.'
    }
    // Use server message if available (simple string detail)
    if (error.response.data && typeof error.response.data === 'object' && 'detail' in error.response.data) {
      const detail = error.response.data.detail
      if (typeof detail === 'string') {
        return detail
      }
    }
  }
  // Generic fallback
  return 'Noe gikk galt. Prøv igjen.'
}
