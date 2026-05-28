import { describe, expect, it } from 'vitest'
import { hasMarkerFilters } from '../markerFilters'

describe('hasMarkerFilters', () => {
    it('treats query, range, date, and status filters as marker-worthy filters', () => {
        expect(hasMarkerFilters({ query: 'bygg' })).toBe(true)
        expect(hasMarkerFilters({ revenueMin: 0 })).toBe(true)
        expect(hasMarkerFilters({ foundedFrom: '2026-01-01' })).toBe(true)
        expect(hasMarkerFilters({ hasAccounting: false })).toBe(true)
    })

    it('returns false when no selective marker filters are active', () => {
        expect(hasMarkerFilters({ organizationForms: [] })).toBe(false)
    })
})