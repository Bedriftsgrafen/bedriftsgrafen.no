import axios, { type AxiosResponse } from 'axios'

// Shared API client configuration
export const API_BASE = '/api'

// Create axios instance with common configuration
export const apiClient = axios.create({
  baseURL: API_BASE,
  paramsSerializer: {
    indexes: null, // Use repeat format for arrays: param=val1&param=val2 instead of param[]=val1
  },
})

export function getResponseRequestId(response: Pick<AxiosResponse, 'headers'>): string | undefined {
  const headers = response.headers as Record<string, unknown> & { get?: (name: string) => unknown }
  const value = typeof headers.get === 'function'
    ? headers.get('x-request-id') ?? headers.get('X-Request-ID')
    : headers['x-request-id'] ?? headers['X-Request-ID']

  return typeof value === 'string' && value.trim() ? value : undefined
}

// Add administrative access interceptor
apiClient.interceptors.request.use((config) => {
  const adminKey = localStorage.getItem('admin_key')
  if (adminKey) {
    config.headers['X-Admin-Key'] = adminKey
  }
  return config
})
