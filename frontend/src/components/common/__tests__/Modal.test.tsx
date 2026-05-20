import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Modal } from '../Modal'

function ModalHarness() {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            <button
                type="button"
                onClick={(event) => {
                    event.currentTarget.focus()
                    setIsOpen(true)
                }}
            >
                Åpne dialog
            </button>
            <Modal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                ariaLabelledBy="modal-title"
                ariaDescribedBy="modal-description"
            >
                <h2 id="modal-title">Testdialog</h2>
                <p id="modal-description">Beskrivelse av dialogen</p>
                <button type="button">Første handling</button>
                <button type="button">Siste handling</button>
            </Modal>
        </>
    )
}

describe('Modal', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'scrollTo', {
            value: vi.fn(),
            writable: true,
        })
    })

    it('supports an aria-label fallback when no labelled heading is provided', () => {
        render(
            <Modal isOpen onClose={vi.fn()} ariaLabel="Generisk dialogtittel">
                <p>Innhold</p>
            </Modal>,
        )

        expect(screen.getByRole('dialog', { name: 'Generisk dialogtittel' })).toBeInTheDocument()
    })

    it('uses aria-labelledby and aria-describedby and restores focus on Escape', async () => {
        render(<ModalHarness />)

        const trigger = screen.getByRole('button', { name: 'Åpne dialog' })
        fireEvent.click(trigger)

        const dialog = screen.getByRole('dialog', { name: 'Testdialog' })

        expect(dialog).toHaveAttribute('aria-describedby', 'modal-description')
        expect(screen.getByRole('button', { name: 'Lukk' })).toHaveFocus()

        fireEvent.keyDown(document, { key: 'Escape' })

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })

        expect(trigger).toHaveFocus()
    })

    it('traps focus between the first and last focusable controls', () => {
        render(<ModalHarness />)

        fireEvent.click(screen.getByRole('button', { name: 'Åpne dialog' }))

        const closeButton = screen.getByRole('button', { name: 'Lukk' })
        const lastButton = screen.getByRole('button', { name: 'Siste handling' })

        lastButton.focus()
        fireEvent.keyDown(document, { key: 'Tab' })
        expect(closeButton).toHaveFocus()

        closeButton.focus()
        fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
        expect(lastButton).toHaveFocus()
    })
})