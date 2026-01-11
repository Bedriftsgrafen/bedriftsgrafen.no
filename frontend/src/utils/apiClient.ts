import axios from 'axios'

// Shared API client configuration
export const API_BASE = '/api'

// Create axios instance with common configuration
export const apiClient = axios.create({
  baseURL: API_BASE,
  paramsSerializer: {
    indexes: null // Use repeat format for arrays: param=val1&param=val2 instead of param[]=val1
  }
})
