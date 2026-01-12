import { describe, it, expect } from 'vitest'
import { apiClient, API_BASE } from '../apiClient'

describe('apiClient', () => {
    it('has correct base URL', () => {
        expect(apiClient.defaults.baseURL).toBe(API_BASE)
    })

    it('uses custom params serializer for arrays', () => {
        const serializer = apiClient.defaults.paramsSerializer as { indexes?: unknown }

        // Ensure it has indexes: null setting or similar logic
        // We can inspect the config directly
        expect(serializer).toBeDefined()
        expect(serializer.indexes).toBe(null)
    })
})
