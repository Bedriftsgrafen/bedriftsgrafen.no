import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AffiliatesPage } from '../affiliates'

vi.mock('../../components/layout', () => ({
    SEOHead: () => <div data-testid="seo-head" />,
}))

vi.mock('../../utils/analytics', () => ({
    trackAffiliateClick: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createFileRoute: () => (config: any) => config,
}))

describe('AffiliatesPage', () => {
    it('renders all paid affiliations with commercial disclosure', () => {
        render(<AffiliatesPage />)

        expect(screen.getByTestId('seo-head')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: /Affiliates og kommersielle lenker/i })).toBeInTheDocument()
        expect(screen.getByText(/kan motta provisjon/i)).toBeInTheDocument()
        expect(screen.getAllByText('Annonse')).toHaveLength(6)

        const links = screen.getAllByRole('link')
        expect(links).toHaveLength(6)
        expect(links.map((link) => link.getAttribute('href'))).toEqual([
            '/api/v1/affiliates/tjenestetorget',
            '/api/v1/affiliates/klikklaan',
            '/api/v1/affiliates/zensum',
            '/api/v1/affiliates/rentesjekk',
            '/api/v1/affiliates/tjenestetorget-forsikring',
            '/api/v1/affiliates/uscore',
        ])

        expect(screen.getAllByText(/Rentesjekk.no er en gratis og uforpliktende tjeneste/i).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Eksempel lån uten sikkerhet/i).length).toBeGreaterThan(0)
    })
})
