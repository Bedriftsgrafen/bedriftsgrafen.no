import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SortSelect } from '../SortSelect'
import { useFilterStore } from '../../../store/filterStore'

describe('SortSelect', () => {
    beforeEach(() => {
        act(() => {
            useFilterStore.setState({ sortBy: 'navn', sortOrder: 'asc' })
        })
    })

    afterEach(() => {
        act(() => {
            useFilterStore.setState({ sortBy: 'navn', sortOrder: 'asc' })
        })
    })

    it('exposes the sort controls as a named group', () => {
        render(<SortSelect />)

        expect(screen.getByRole('group', { name: 'Sorter resultater' })).toBeInTheDocument()
        expect(screen.getByRole('combobox', { name: 'Sorter etter' })).toBeInTheDocument()
    })

    it('announces the current sort direction and the next action', () => {
        render(<SortSelect />)

        const directionButton = screen.getByRole('button', {
            name: 'Sorteringsretning: stigende. Bytt til synkende.',
        })

        fireEvent.click(directionButton)

        expect(
            screen.getByRole('button', { name: 'Sorteringsretning: synkende. Bytt til stigende.' })
        ).toBeInTheDocument()
    })

    it('uses descending order as the default for numeric sort fields', () => {
        render(<SortSelect />)

        const select = screen.getByRole('combobox', { name: 'Sorter etter' })
        fireEvent.change(select, { target: { value: 'revenue' } })

        expect(useFilterStore.getState().sortBy).toBe('revenue')
        expect(useFilterStore.getState().sortOrder).toBe('desc')
    })
})