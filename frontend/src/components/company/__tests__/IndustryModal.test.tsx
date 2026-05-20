import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IndustryModal } from '../IndustryModal'

const mockNavigate = vi.fn()
const mockUseIndustryQuery = vi.fn()

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => mockNavigate,
}))

vi.mock('../../../hooks/queries/useIndustryQuery', () => ({
    useIndustryQuery: (args: unknown) => mockUseIndustryQuery(args),
}))

function IndustryModalHarness() {
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
                Åpne bransjemodal
            </button>
            <IndustryModal
                isOpen={isOpen}
                naceCode="62.010"
                naceDescription="Programmeringstjenester"
                onClose={() => setIsOpen(false)}
            />
        </>
    )
}

describe('IndustryModal', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'scrollTo', {
            value: vi.fn(),
            writable: true,
        })

        mockNavigate.mockReset()
        mockUseIndustryQuery.mockReset()
        mockUseIndustryQuery.mockReturnValue({
            data: {
                total: 1,
                pages: 1,
                items: [
                    {
                        orgnr: '123456789',
                        navn: 'Test Company AS',
                        organisasjonsform: 'AS',
                        antall_ansatte: 4,
                    },
                ],
            },
            isLoading: false,
            isFetching: false,
            isError: false,
            error: null,
        })
    })

    it('exposes a named dialog and restores focus to the trigger on Escape', async () => {
        render(<IndustryModalHarness />)

        const trigger = screen.getByRole('button', { name: 'Åpne bransjemodal' })
        fireEvent.click(trigger)

        const dialog = screen.getByRole('dialog', { name: 'Bransje: 62.010' })
        expect(dialog).toHaveAttribute('aria-describedby')
        expect(screen.getByRole('button', { name: 'Lukk' })).toHaveFocus()

        fireEvent.keyDown(document, { key: 'Escape' })

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })

        expect(trigger).toHaveFocus()
    })
})