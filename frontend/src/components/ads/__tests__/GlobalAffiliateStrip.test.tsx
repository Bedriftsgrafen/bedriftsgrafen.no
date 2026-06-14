import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GlobalAffiliateStrip } from '../GlobalAffiliateStrip'

vi.mock('../../../utils/analytics', () => ({
    trackAffiliateClick: vi.fn(),
}))

describe('GlobalAffiliateStrip', () => {
    it('renders three rotated paid affiliate links sitewide', () => {
        render(<GlobalAffiliateStrip rotationDate={new Date('2026-06-14T12:00:00Z')} />)

        expect(screen.getByRole('heading', { name: 'Aktuelle tjenester' })).toBeInTheDocument()
        expect(screen.getAllByText('Annonse')).toHaveLength(3)
        const links = screen.getAllByRole('link')

        expect(links).toHaveLength(3)
        expect(new Set(links.map((link) => link.getAttribute('href'))).size).toBe(3)
        for (const link of links) {
            expect(link.getAttribute('href')).toMatch(/^\/api\/v1\/affiliates\//)
        }
    })
})
