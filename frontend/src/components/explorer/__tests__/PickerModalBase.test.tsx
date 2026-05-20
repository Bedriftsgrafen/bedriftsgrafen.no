import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PickerModalBase } from '../PickerModalBase'

function PickerModalHarness() {
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
                Åpne velger
            </button>
            <PickerModalBase
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                title="Velg bransje"
                titleId="picker-modal-title"
                onConfirm={() => setIsOpen(false)}
                onClear={vi.fn()}
                searchContent={<input aria-label="Søk etter bransje" />}
            >
                <button type="button">Bransjevalg</button>
            </PickerModalBase>
        </>
    )
}

describe('PickerModalBase', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'scrollTo', {
            value: vi.fn(),
            writable: true,
        })
    })

    it('focuses the search input on open and restores focus to the trigger on Escape', async () => {
        render(<PickerModalHarness />)

        const trigger = screen.getByRole('button', { name: 'Åpne velger' })
        fireEvent.click(trigger)

        expect(screen.getByRole('dialog', { name: 'Velg bransje' })).toBeInTheDocument()
        expect(screen.getByRole('textbox', { name: 'Søk etter bransje' })).toHaveFocus()

        fireEvent.keyDown(document, { key: 'Escape' })

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })

        expect(trigger).toHaveFocus()
    })
})