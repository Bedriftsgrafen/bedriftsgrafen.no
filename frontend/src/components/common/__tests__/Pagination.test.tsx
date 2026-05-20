import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Pagination } from '../Pagination'

describe('Pagination', () => {
    it('marks the pagination controls as a navigation landmark and announces the page summary', () => {
        render(
            <Pagination
                currentPage={2}
                totalCount={95}
                itemsPerPage={10}
                currentItemsCount={10}
                onPreviousPage={() => {}}
                onNextPage={() => {}}
                onPageChange={() => {}}
            />
        )

        expect(screen.getByRole('navigation', { name: 'Paginering for virksomheter' })).toBeInTheDocument()
        expect(screen.getByText('Viser 11-20 av 95 virksomheter')).toHaveAttribute('aria-live', 'polite')
    })

    it('disables next and last buttons on the exact last page', () => {
        render(
            <Pagination
                currentPage={10}
                totalCount={100}
                itemsPerPage={10}
                currentItemsCount={10}
                onPreviousPage={() => {}}
                onNextPage={() => {}}
                onPageChange={() => {}}
            />
        )

        expect(screen.getByRole('button', { name: 'Neste side' })).toBeDisabled()
        expect(screen.getByRole('button', { name: 'Siste side' })).toBeDisabled()
    })

    it('calls page change handlers for numbered and directional navigation', () => {
        const onPreviousPage = vi.fn()
        const onNextPage = vi.fn()
        const onPageChange = vi.fn()

        render(
            <Pagination
                currentPage={2}
                totalCount={100}
                itemsPerPage={10}
                currentItemsCount={10}
                onPreviousPage={onPreviousPage}
                onNextPage={onNextPage}
                onPageChange={onPageChange}
            />
        )

        fireEvent.click(screen.getByRole('button', { name: 'Forrige side' }))
        fireEvent.click(screen.getByRole('button', { name: 'Neste side' }))
        fireEvent.click(screen.getByRole('button', { name: 'Side 5' }))
        fireEvent.click(screen.getByRole('button', { name: 'Første side' }))
        fireEvent.click(screen.getByRole('button', { name: 'Siste side' }))

        expect(onPreviousPage).toHaveBeenCalledTimes(1)
        expect(onNextPage).toHaveBeenCalledTimes(1)
        expect(onPageChange).toHaveBeenNthCalledWith(1, 5)
        expect(onPageChange).toHaveBeenNthCalledWith(2, 1)
        expect(onPageChange).toHaveBeenNthCalledWith(3, 10)
    })
})