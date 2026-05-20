import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, afterEach } from 'vitest'
import { CONTACT_EMAIL, getContactGmailComposeHref } from '../../../constants/contact'
import { BedriftsgrafenContactLink } from '../BedriftsgrafenContactLink'

describe('BedriftsgrafenContactLink', () => {
    afterEach(() => {
        window.history.pushState({}, '', '/')
    })

    it('opens a confirmation modal before exposing the email link', () => {
        render(<BedriftsgrafenContactLink>Kontakt</BedriftsgrafenContactLink>)

        fireEvent.click(screen.getByRole('button', { name: 'Kontakt' }))

        const dialog = screen.getByRole('dialog', { name: 'Kontakt Bedriftsgrafen.no' })

        expect(dialog).toHaveAttribute('aria-describedby')
        expect(screen.getByRole('heading', { name: 'Kontakt Bedriftsgrafen.no' })).toBeInTheDocument()
        expect(screen.getByText('Du kontakter Bedriftsgrafen.no, ikke en virksomhet eller person omtalt på siden.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Lukk' })).toHaveFocus()

        const emailLink = screen.getByRole('link', { name: `Åpne e-post til ${CONTACT_EMAIL}` })
        expect(emailLink).toHaveAttribute('href', getContactGmailComposeHref())
    })

    it('closes on Escape and restores focus to the trigger', async () => {
        render(<BedriftsgrafenContactLink>Kontakt</BedriftsgrafenContactLink>)

        const trigger = screen.getByRole('button', { name: 'Kontakt' })
        fireEvent.click(trigger)

        expect(screen.getByRole('dialog', { name: 'Kontakt Bedriftsgrafen.no' })).toBeInTheDocument()

        fireEvent.keyDown(document, { key: 'Escape' })

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })

        expect(trigger).toHaveFocus()
    })

    it('requires explicit confirmation on company profile pages', () => {
        window.history.pushState({}, '', '/virksomhet/123456789')
        render(<BedriftsgrafenContactLink>Kontakt</BedriftsgrafenContactLink>)

        fireEvent.click(screen.getByRole('button', { name: 'Kontakt' }))

        const emailLink = screen.getByRole('link', { name: `Åpne e-post til ${CONTACT_EMAIL}` })
        expect(emailLink).toHaveAttribute('aria-disabled', 'true')

        fireEvent.click(screen.getByRole('checkbox', { name: /jeg forstår/i }))

        expect(emailLink).toHaveAttribute('aria-disabled', 'false')
    })

    it('infers the current route when the user clicks', () => {
        render(<BedriftsgrafenContactLink>Kontakt</BedriftsgrafenContactLink>)

        window.history.pushState({}, '', '/virksomhet/123456789')
        fireEvent.click(screen.getByRole('button', { name: 'Kontakt' }))

        expect(screen.getByText('Du kontakter Bedriftsgrafen.no, ikke virksomheten på siden.')).toBeInTheDocument()
        expect(screen.getByRole('checkbox', { name: /ikke virksomheten jeg nettopp så på/i })).toBeInTheDocument()
    })

    it('uses person-specific confirmation on person profile pages', () => {
        window.history.pushState({}, '', '/person/Ola%20Nordmann/1980')
        render(<BedriftsgrafenContactLink>Kontakt</BedriftsgrafenContactLink>)

        fireEvent.click(screen.getByRole('button', { name: 'Kontakt' }))

        expect(screen.getByText('Du kontakter Bedriftsgrafen.no, ikke personen på siden.')).toBeInTheDocument()
        expect(screen.getByRole('checkbox', { name: /ikke personen jeg nettopp så på/i })).toBeInTheDocument()

        const emailLink = screen.getByRole('link', { name: `Åpne e-post til ${CONTACT_EMAIL}` })
        expect(emailLink).toHaveAttribute('aria-disabled', 'true')
    })

    it('uses the Gmail compose action for the email button', () => {
        render(<BedriftsgrafenContactLink>Kontakt</BedriftsgrafenContactLink>)

        fireEvent.click(screen.getByRole('button', { name: 'Kontakt' }))

        const emailLink = screen.getByRole('link', { name: `Åpne e-post til ${CONTACT_EMAIL}` })
        expect(emailLink).toHaveAttribute('href', getContactGmailComposeHref())
        expect(emailLink).toHaveAttribute('target', '_blank')
    })
})