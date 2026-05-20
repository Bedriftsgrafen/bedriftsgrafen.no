import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GlobalAffiliateStrip } from '../GlobalAffiliateStrip'

vi.mock('../../../utils/analytics', () => ({
    trackAffiliateClick: vi.fn(),
}))

describe('GlobalAffiliateStrip', () => {
    it('renders all paid affiliate links sitewide', () => {
        render(<GlobalAffiliateStrip />)

        expect(screen.getByRole('heading', { name: 'Aktuelle tjenester' })).toBeInTheDocument()
        expect(screen.getAllByText('Annonse')).toHaveLength(3)
        expect(screen.getAllByRole('link')).toHaveLength(3)

        expect(screen.getByRole('link', { name: /Se lånemuligheter hos KlikkLån/i })).toHaveAttribute(
            'href',
            '/api/v1/affiliates/klikklaan'
        )
        expect(screen.getByRole('link', { name: /Sammenlign tilbud hos Tjenestetorget/i })).toHaveAttribute(
            'href',
            '/api/v1/affiliates/tjenestetorget'
        )
        expect(screen.getByRole('link', { name: /Sammenlign tilbud hos Zensum/i })).toHaveAttribute(
            'href',
            '/api/v1/affiliates/zensum'
        )
        expect(screen.getByText('Finn regnskapsfører hos Tjenestetorget')).toBeInTheDocument()
        expect(screen.getByText('Lån opptil 70 000 kr hos KlikkLån')).toBeInTheDocument()
        expect(screen.getByText('Sammenlign lån og refinansiering hos Zensum')).toBeInTheDocument()
        expect(screen.getByLabelText('Renteeksempler og vilkår')).toBeInTheDocument()
        expect(screen.getByText(/Nominell rente fra 12,0 %/i)).toBeInTheDocument()
        expect(screen.getByText(/Eksempel lån uten sikkerhet/i)).toBeInTheDocument()
    })
})