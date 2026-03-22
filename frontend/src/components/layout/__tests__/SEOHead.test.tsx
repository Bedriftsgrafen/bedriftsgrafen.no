import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { SEOHead } from '../SEOHead'

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
    useLocation: () => ({ pathname: '/test-page' }),
}))

describe('SEOHead', () => {
    afterEach(() => {
        // Let React clean up first, then remove any orphaned meta tags
        cleanup()
        document.head.querySelectorAll('meta[name="robots"]').forEach(el => el.remove())
    })

    it('does not render noindex meta by default', () => {
        render(
            <SEOHead title="Test Page" description="Test description" />
        )
        const robots = document.head.querySelector('meta[name="robots"]')
        expect(robots).toBeNull()
    })

    it('renders noindex meta when noindex prop is true', () => {
        render(
            <SEOHead title="Test Page" description="Test description" noindex />
        )
        const robots = document.head.querySelector('meta[name="robots"]')
        expect(robots).not.toBeNull()
        expect(robots?.getAttribute('content')).toBe('noindex, nofollow')
    })

    it('does not render noindex meta when noindex prop is false', () => {
        render(
            <SEOHead title="Test Page" description="Test description" noindex={false} />
        )
        const robots = document.head.querySelector('meta[name="robots"]')
        expect(robots).toBeNull()
    })
})
