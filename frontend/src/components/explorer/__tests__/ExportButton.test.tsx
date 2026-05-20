import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExportButton } from '../ExportButton'

const mockTrackEvent = vi.fn()

vi.mock('../../../hooks/useFilterParams', () => ({
    useFilterParams: () => ({
        filterParams: {},
        sortBy: 'navn',
        sortOrder: 'asc',
    }),
}))

vi.mock('../../../utils/analytics', () => ({
    trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}))

vi.mock('../../../utils/logger', () => ({
    logger: {
        error: vi.fn(),
    },
}))

describe('ExportButton', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'scrollTo', {
            value: vi.fn(),
            writable: true,
        })

        mockTrackEvent.mockReset()
    })

    it('keeps an accessible trigger name and opens a named pro dialog', async () => {
        render(<ExportButton totalCount={1200} />)

        const trigger = screen.getByRole('button', { name: 'Eksporter første 1 000 virksomheter' })
        expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
        expect(trigger).toHaveAttribute('aria-expanded', 'false')

        trigger.focus()
        fireEvent.click(trigger)

        const dialog = screen.getByRole('dialog', { name: 'Lås opp data-eksport 🚀' })
        expect(dialog).toHaveAttribute('aria-describedby')
        expect(trigger).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByRole('button', { name: 'Lukk' })).toHaveFocus()

        fireEvent.keyDown(document, { key: 'Escape' })

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })

        expect(trigger).toHaveFocus()
    })
})