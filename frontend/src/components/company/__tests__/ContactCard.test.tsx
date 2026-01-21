import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { ContactCard } from '../ContactCard'

describe('ContactCard', () => {
    it('renders phone link with tel: protocol', () => {
        render(<ContactCard telefon="51 99 00 00" />)

        const phoneLink = screen.getByRole('link', { name: '51 99 00 00' })
        expect(phoneLink).toHaveAttribute('href', 'tel:51990000')
    })

    it('renders mobile link with tel: protocol', () => {
        render(<ContactCard mobil="921 18 292" />)

        const mobileLink = screen.getByRole('link', { name: '921 18 292' })
        expect(mobileLink).toHaveAttribute('href', 'tel:92118292')
    })

    it('renders email link with mailto: protocol', () => {
        render(<ContactCard epostadresse="test@example.com" />)

        const emailLink = screen.getByRole('link', { name: 'test@example.com' })
        expect(emailLink).toHaveAttribute('href', 'mailto:test@example.com')
    })

    it('renders website link with https:// prefix if missing', () => {
        render(<ContactCard hjemmeside="www.example.com" />)

        const websiteLink = screen.getByRole('link', { name: 'www.example.com' })
        expect(websiteLink).toHaveAttribute('href', 'https://www.example.com')
        expect(websiteLink).toHaveAttribute('target', '_blank')
    })

    it('renders website link without adding prefix if already has http', () => {
        render(<ContactCard hjemmeside="https://secure.example.com" />)

        const websiteLink = screen.getByRole('link', { name: 'https://secure.example.com' })
        expect(websiteLink).toHaveAttribute('href', 'https://secure.example.com')
    })

    it('hides fields that are undefined', () => {
        render(<ContactCard telefon="12345678" />)

        expect(screen.getByText('Telefon')).toBeInTheDocument()
        expect(screen.queryByText('Mobil')).not.toBeInTheDocument()
        expect(screen.queryByText('E-post')).not.toBeInTheDocument()
        expect(screen.queryByText('Nettside')).not.toBeInTheDocument()
    })

    it('returns null when no contact info is provided', () => {
        const { container } = render(<ContactCard />)
        expect(container.firstChild).toBeNull()
    })

    it('renders all contact fields when provided', () => {
        render(
            <ContactCard
                telefon="12345678"
                mobil="87654321"
                epostadresse="contact@test.no"
                hjemmeside="test.no"
            />
        )

        expect(screen.getByText('Telefon')).toBeInTheDocument()
        expect(screen.getByText('Mobil')).toBeInTheDocument()
        expect(screen.getByText('E-post')).toBeInTheDocument()
        expect(screen.getByText('Nettside')).toBeInTheDocument()
    })
})
