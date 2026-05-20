import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CONTACT_EMAIL } from '../../constants/contact'
import { Footer } from '../Footer'

describe('Footer', () => {
    it('opens the Bedriftsgrafen contact modal instead of a direct mailto link', () => {
        render(<Footer />)

        const contactButton = screen.getByRole('button', { name: CONTACT_EMAIL })
        expect(contactButton).not.toHaveAttribute('href')

        fireEvent.click(contactButton)

        const dialog = screen.getByRole('dialog', { name: 'Kontakt Bedriftsgrafen.no' })
        expect(within(dialog).getByRole('heading', { name: 'Kontakt Bedriftsgrafen.no' })).toBeInTheDocument()
        expect(within(dialog).getByText('Du kontakter Bedriftsgrafen.no, ikke en virksomhet eller person omtalt på siden.')).toBeInTheDocument()
    })
})