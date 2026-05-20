import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SortableHeader } from '../SortableHeader'

describe('SortableHeader', () => {
    it('uses a native button for sortable column headers', () => {
        const onSort = vi.fn()

        render(
            <table>
                <thead>
                    <tr>
                        <SortableHeader
                            field="navn"
                            label="Navn"
                            currentSort="navn"
                            sortOrder="asc"
                            onSort={onSort}
                        />
                    </tr>
                </thead>
            </table>
        )

        const header = screen.getByRole('columnheader', { name: /Navn/i })
        const button = screen.getByRole('button', { name: 'Sorter etter Navn, synkende' })

        expect(header).toHaveAttribute('aria-sort', 'ascending')

        fireEvent.click(button)

        expect(onSort).toHaveBeenCalledWith('navn')
    })
})