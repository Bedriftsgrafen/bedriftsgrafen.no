import { create } from 'zustand'
import axios from 'axios'
import { getMessageForCode } from '../utils/errorCodes'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  message: string
  duration: number
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
      toasts: [...state.toasts, { id, type, message, duration }],
    }))
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))

// Helper functions for common toast scenarios
export const toast = {
  success: (message: string) => useToastStore.getState().addToast('success', message),
  error: (message: string) => useToastStore.getState().addToast('error', message, 10000),
  warning: (message: string) => useToastStore.getState().addToast('warning', message, 6000),
  info: (message: string) => useToastStore.getState().addToast('info', message),
}

export function withRequestReference(message: string, requestId?: string | null): string {
  return requestId ? `${message} Referanse: ${requestId}.` : message
}

function getHeaderValue(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== 'object') return undefined

  const maybeHeaders = headers as Record<string, unknown> & { get?: (headerName: string) => unknown }
  const value = typeof maybeHeaders.get === 'function'
    ? maybeHeaders.get(name) ?? maybeHeaders.get(name.toLowerCase())
    : maybeHeaders[name] ?? maybeHeaders[name.toLowerCase()]

  return typeof value === 'string' && value.trim() ? value : undefined
}

function shouldIncludeRequestReference(status: number, code?: string): boolean {
  return status >= 500 || code === 'BRREG_API_ERROR'
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
    const requestId = getHeaderValue(error.response.headers, 'X-Request-ID')
    // Prefer stable error code from API response over generic status fallback
    const responseCode = typeof error.response.data === 'object' && error.response.data !== null
      ? (error.response.data as { code?: string }).code
      : undefined
    if (responseCode) {
      const codeMessage = getMessageForCode(responseCode)
      if (codeMessage) {
        return shouldIncludeRequestReference(status, responseCode)
          ? withRequestReference(codeMessage, requestId)
          : codeMessage
      }
    }
    const detail = typeof error.response.data === 'object' && error.response.data !== null && 'detail' in error.response.data
      ? error.response.data.detail
      : undefined
    if ((status === 502 || status === 503) && typeof detail === 'string' && detail.includes('Brønnøysund')) {
      return withRequestReference('Kunne ikke hente data fra Brønnøysundregistrene. Prøv igjen.', requestId)
    }
    if (status === 404) {
      return 'Ressursen ble ikke funnet.'
    }
    if (status >= 500) {
      return withRequestReference('Serverfeil. Prøv igjen senere.', requestId)
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
    if (typeof detail === 'string') {
      return detail
    }
  }
  // Generic fallback
  return 'Noe gikk galt. Prøv igjen.'
}
