/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PersonToplistTab } from '../PersonToplistTab'
import type { PersonToplistResponse } from '../../../types/person'

// Mock router Link
vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, ...props }: any) => <a data-testid="person-link" {...props}>{children}</a>,
}))

const MOCK_TOPLISTS: PersonToplistResponse[] = [
    {
        category: 'active_roles',
        entries: [
            { rank: 1, name: 'Ola Nordmann', birth_year: 1970, value: 120, active_roles: 120, active_companies: 45 },
            { rank: 2, name: 'Kari Hansen', birth_year: 1965, value: 98, active_roles: 98, active_companies: 32 },
            { rank: 3, name: 'Per Olsen', birth_year: 1980, value: 85, active_roles: 85, active_companies: 28 },
            { rank: 4, name: 'Nils Berg', birth_year: 1975, value: 70, active_roles: 70, active_companies: 22 },
        ],
    },
    {
        category: 'LEDE',
        entries: [
            { rank: 1, name: 'Trude Moen', birth_year: 1972, value: 50, active_roles: 80, active_companies: 50 },
        ],
    },
    {
        category: 'salgsinntekter',
        entries: [
            { rank: 1, name: 'Stor Bedrift', birth_year: 1955, value: 5_000_000_000, active_roles: 8, active_companies: 5 },
        ],
    },
]

describe('PersonToplistTab', () => {
    it('renders all category buttons', () => {
        render(
            <PersonToplistTab
                toplists={MOCK_TOPLISTS}
                selectedCategory="active_roles"
                onCategoryChange={vi.fn()}
            />
        )

        const buttons = screen.getAllByRole('button')
        const buttonLabels = buttons.map(b => b.textContent)
        expect(buttonLabels).toContain('Aktive roller')
        expect(buttonLabels).toContain('Styreleder')
        expect(buttonLabels).toContain('Daglig leder')
        expect(buttonLabels).toContain('Styremedlem')
        expect(buttonLabels).toContain('Selskaper')
        expect(buttonLabels).toContain('Bransjemangfold')
        expect(buttonLabels).toContain('Omsetning')
    })

    it('renders entries for the selected category', () => {
        render(
            <PersonToplistTab
                toplists={MOCK_TOPLISTS}
                selectedCategory="active_roles"
                onCategoryChange={vi.fn()}
            />
        )

        expect(screen.getByText('Ola Nordmann')).toBeInTheDocument()
        expect(screen.getByText('Kari Hansen')).toBeInTheDocument()
        expect(screen.getByText('Per Olsen')).toBeInTheDocument()
    })

    it('shows birth year for entries', () => {
        render(
            <PersonToplistTab
                toplists={MOCK_TOPLISTS}
                selectedCategory="active_roles"
                onCategoryChange={vi.fn()}
            />
        )

        expect(screen.getByText('f. 1970')).toBeInTheDocument()
        expect(screen.getByText('f. 1965')).toBeInTheDocument()
    })

    it('renders table headers', () => {
        render(
            <PersonToplistTab
                toplists={MOCK_TOPLISTS}
                selectedCategory="active_roles"
                onCategoryChange={vi.fn()}
            />
        )

        expect(screen.getByText('#')).toBeInTheDocument()
        expect(screen.getByText('Navn')).toBeInTheDocument()
        expect(screen.getByText('Verdi')).toBeInTheDocument()
    })

    it('calls onCategoryChange when a category button is clicked', () => {
        const onCategoryChange = vi.fn()
        render(
            <PersonToplistTab
                toplists={MOCK_TOPLISTS}
                selectedCategory="active_roles"
                onCategoryChange={onCategoryChange}
            />
        )

        fireEvent.click(screen.getByText('Styreleder'))

        expect(onCategoryChange).toHaveBeenCalledWith('LEDE')
    })

    it('switches display when category changes', () => {
        render(
            <PersonToplistTab
                toplists={MOCK_TOPLISTS}
                selectedCategory="LEDE"
                onCategoryChange={vi.fn()}
            />
        )

        expect(screen.getByText('Trude Moen')).toBeInTheDocument()
        expect(screen.queryByText('Ola Nordmann')).not.toBeInTheDocument()
    })

    it('handles empty toplists gracefully', () => {
        const { container } = render(
            <PersonToplistTab
                toplists={[]}
                selectedCategory="active_roles"
                onCategoryChange={vi.fn()}
            />
        )

        // Category buttons still render, no table
        expect(screen.getByText('Aktive roller')).toBeInTheDocument()
        expect(container.querySelector('table')).not.toBeInTheDocument()
    })

    it('formats revenue with formatCurrency for salgsinntekter category', () => {
        render(
            <PersonToplistTab
                toplists={MOCK_TOPLISTS}
                selectedCategory="salgsinntekter"
                onCategoryChange={vi.fn()}
            />
        )
        // formatCurrency(5_000_000_000) = '5.0 mrd'
        expect(screen.getByText('5.0 mrd')).toBeInTheDocument()
    })
})
