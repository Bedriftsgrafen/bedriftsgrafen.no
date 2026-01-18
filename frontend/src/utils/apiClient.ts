import axios from 'axios'

// Shared API client configuration
export const API_BASE = '/api'

// Create axios instance with common configuration
export const apiClient = axios.create({
  baseURL: API_BASE,
  paramsSerializer: {
    indexes: null, // Use repeat format for arrays: param=val1&param=val2 instead of param[]=val1
  },
})

// Add administrative access interceptor
apiClient.interceptors.request.use((config) => {
  const adminKey = localStorage.getItem('admin_key')
  if (adminKey) {
    config.headers['X-Admin-Key'] = adminKey
  }
  return config
})
