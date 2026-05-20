import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LiveDataPanel } from '../LiveDataPanel'
import { useStatsQuery } from '../../../hooks/queries/useStatsQuery'

vi.mock('../../../hooks/queries/useStatsQuery', () => ({
    useStatsQuery: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, to, className }: {
        children: React.ReactNode
        to: string
        className?: string
    }) => <a href={to} className={className}>{children}</a>,
}))

describe('LiveDataPanel', () => {
    it('links to bankruptcies and new companies', () => {
        vi.mocked(useStatsQuery).mockReturnValue({
            data: {
                total_companies: 1140000,
                total_accounting_reports: 750000,
                total_revenue: 0,
                total_ebitda: 0,
                total_employees: 0,
                profitable_percentage: 0,
                solid_company_percentage: 0,
                avg_operating_margin: 0,
                new_companies_ytd: 1600,
                new_companies_30d: 1600,
                bankruptcies: 100,
                geocoded_count: 1100000,
                total_roles: 0,
                avg_board_age: 0,
            },
            isLoading: false,
        } as ReturnType<typeof useStatsQuery>)

        render(<LiveDataPanel />)

        expect(screen.getByRole('link', { name: /Se konkurser/i })).toHaveAttribute('href', '/konkurser')
        expect(screen.getByRole('link', { name: /Se nyetableringer/i })).toHaveAttribute('href', '/nyetableringer')
    })
})