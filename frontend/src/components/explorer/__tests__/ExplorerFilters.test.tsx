import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExplorerFilters } from '../ExplorerFilters'
import { useFilterStore } from '../../../store/filterStore'

describe('ExplorerFilters', () => {
    beforeEach(() => {
        useFilterStore.getState().clearFilters()
    })

    it('uses the route clear handler when provided', () => {
        const onClearFilters = vi.fn()
        useFilterStore.setState({ organizationForms: ['AS'] })

        render(<ExplorerFilters onClearFilters={onClearFilters} />)

        fireEvent.click(screen.getByRole('button', { name: /Nullstill/i }))

        expect(onClearFilters).toHaveBeenCalledTimes(1)
    })

    it('routes organization form changes through onFilterChange when provided', () => {
        const onFilterChange = vi.fn()

        render(<ExplorerFilters onFilterChange={onFilterChange} />)

        fireEvent.click(screen.getByRole('checkbox', { name: 'Aksjeselskap (AS)' }))

        expect(onFilterChange).toHaveBeenCalledWith({ organizationForms: ['AS'] })
    })
})