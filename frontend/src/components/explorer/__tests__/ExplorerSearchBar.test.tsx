import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ExplorerSearchBar } from '../ExplorerSearchBar'
import { useMunicipalitiesListQuery } from '../../../hooks/queries/useMunicipalityQuery'

vi.mock('../../../hooks/queries/useMunicipalityQuery', () => ({
    useMunicipalitiesListQuery: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, ...props }: { children: ReactNode }) => <a {...props}>{children}</a>,
}))

describe('ExplorerSearchBar', () => {
    const mockUseMunicipalitiesListQuery = vi.mocked(useMunicipalitiesListQuery)

    beforeEach(() => {
        mockUseMunicipalitiesListQuery.mockReturnValue({
            data: [
                { code: '0301', slug: 'oslo', name: 'Oslo', company_count: 1000 },
                { code: '3201', slug: 'asker', name: 'Asker', company_count: 500 },
            ],
        } as ReturnType<typeof useMunicipalitiesListQuery>)
    })

    it('gives the explorer search field an accessible name', () => {
        render(<ExplorerSearchBar initialValue="" onSearch={() => {}} />)

        expect(
            screen.getByRole('textbox', { name: 'Søk etter virksomhet, bransje eller formål' })
        ).toBeInTheDocument()
    })

    it('renders the inline search suggestion as a native button', () => {
        const onSearch = vi.fn()
        render(<ExplorerSearchBar initialValue="" onSearch={onSearch} />)

        const input = screen.getByRole('textbox', { name: 'Søk etter virksomhet, bransje eller formål' })
        fireEvent.focus(input)
        fireEvent.change(input, { target: { value: 'Osl' } })

        const quickSearchButton = screen.getByRole('button', { name: /Søk etter "Osl"/i })

        expect(quickSearchButton.tagName).toBe('BUTTON')

        fireEvent.click(quickSearchButton)

        expect(onSearch).toHaveBeenCalledWith('Osl')
    })

    it('blocks broad two-character company searches', () => {
        const onSearch = vi.fn()
        render(<ExplorerSearchBar initialValue="" onSearch={onSearch} />)

        const input = screen.getByRole('textbox', { name: 'Søk etter virksomhet, bransje eller formål' })
        fireEvent.change(input, { target: { value: 'as' } })

        expect(screen.getByText('Skriv minst 3 tegn for virksomhetssøk.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Søk' })).toBeDisabled()
    })
})