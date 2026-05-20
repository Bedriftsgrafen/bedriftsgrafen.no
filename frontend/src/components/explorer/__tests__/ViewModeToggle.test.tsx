import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { ViewModeToggle } from '../ViewModeToggle'
import { useExplorerStore } from '../../../store/explorerStore'

describe('ViewModeToggle', () => {
    beforeEach(() => {
        act(() => {
            useExplorerStore.setState({ viewMode: 'list' })
        })
    })

    afterEach(() => {
        act(() => {
            useExplorerStore.setState({ viewMode: 'list' })
        })
    })

    it('exposes the list-card toggle as a named group', () => {
        render(<ViewModeToggle />)

        expect(screen.getByRole('group', { name: 'Velg visning' })).toBeInTheDocument()
    })

    it('updates pressed state when switching to card view', () => {
        render(<ViewModeToggle />)

        const listButton = screen.getByRole('button', { name: 'Listevisning' })
        const cardButton = screen.getByRole('button', { name: 'Kortvisning' })

        expect(listButton).toHaveAttribute('aria-pressed', 'true')
        expect(cardButton).toHaveAttribute('aria-pressed', 'false')

        fireEvent.click(cardButton)

        expect(listButton).toHaveAttribute('aria-pressed', 'false')
        expect(cardButton).toHaveAttribute('aria-pressed', 'true')
    })
})