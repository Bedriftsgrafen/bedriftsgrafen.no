import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NacePickerModal } from '../modals/NacePickerModal'

const mockApiGet = vi.fn()

vi.mock('../../../utils/apiClient', () => ({
    apiClient: {
        get: (...args: unknown[]) => mockApiGet(...args),
    },
}))

vi.mock('../../../utils/logger', () => ({
    logger: {
        error: vi.fn(),
    },
}))

vi.mock('../../../hooks/useSlowLoadingToast', () => ({
    useSlowLoadingToast: vi.fn(),
}))

describe('NacePickerModal', () => {
    beforeEach(() => {
        mockApiGet.mockReset()
        mockApiGet.mockResolvedValue({ data: [] })
    })

    it('gives the NACE search input an accessible name', async () => {
        render(
            <NacePickerModal
                isOpen
                onClose={() => {}}
                selectedCode=""
                onSelect={() => {}}
            />
        )

        await act(async () => {
            await Promise.resolve()
        })

        expect(screen.getByRole('textbox', { name: 'Søk etter bransje eller kode' })).toBeInTheDocument()
    })

    it('announces expand/collapse state for tree toggle buttons', async () => {
        render(
            <NacePickerModal
                isOpen
                onClose={() => {}}
                selectedCode=""
                onSelect={() => {}}
            />
        )

        await act(async () => {
            await Promise.resolve()
        })

        const toggle = screen.getByRole('button', { name: /Utvid A Jordbruk, skogbruk og fiske/i })
        expect(toggle).toHaveAttribute('aria-expanded', 'false')

        fireEvent.click(toggle)

        expect(toggle).toHaveAttribute('aria-expanded', 'true')
        expect(toggle).toHaveAttribute('aria-label', 'Skjul A Jordbruk, skogbruk og fiske')
    })
})