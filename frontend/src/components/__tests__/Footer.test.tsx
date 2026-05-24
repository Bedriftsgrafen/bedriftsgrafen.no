import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Footer } from '../Footer'

describe('Footer', () => {
    it('opens the Bedriftsgrafen contact modal instead of a direct mailto link', async () => {
        render(<Footer />)

        expect(screen.queryByText('bedriftsgrafen@gmail.com')).not.toBeInTheDocument()

        const contactButton = screen.getByRole('button', { name: /send e-post om nettsiden/i })
        expect(contactButton).not.toHaveAttribute('href')

        fireEvent.click(contactButton)

        const dialog = await screen.findByRole('dialog', { name: 'Kontakt Bedriftsgrafen.no' })
        expect(within(dialog).getByRole('heading', { name: 'Kontakt Bedriftsgrafen.no' })).toBeInTheDocument()
        expect(within(dialog).getByText('Du kontakter Bedriftsgrafen.no, ikke en virksomhet eller person omtalt på siden.')).toBeInTheDocument()
    })
})