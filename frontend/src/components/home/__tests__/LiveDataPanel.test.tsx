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
    it('shows activity cards with existing overview links', () => {
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

        expect(screen.getByRole('heading', { name: 'Siste bevegelser' })).toBeInTheDocument()
        expect(screen.getByText('Nye virksomheter')).toBeInTheDocument()
        expect(screen.getByText('Basert på registreringsdatoer i Enhetsregisteret.')).toBeInTheDocument()
        expect(screen.getByText('Konkurser og avvikling')).toBeInTheDocument()
        expect(screen.getByText('Status bør kontrolleres mot Brreg ved juridisk bruk.')).toBeInTheDocument()
        expect(screen.getByText('Regnskapsgrunnlag')).toBeInTheDocument()
        expect(screen.getByText('Dekning hos Bedriftsgrafen, ikke siste innsendingsdato.')).toBeInTheDocument()

        expect(screen.getByRole('link', { name: /Se alle oppdateringer/i })).toHaveAttribute('href', '/oppdateringer')
        expect(screen.getAllByRole('link', { name: /Se konkurser/i })[0]).toHaveAttribute('href', '/konkurser')
        expect(screen.getAllByRole('link', { name: /Se nyetableringer/i })[0]).toHaveAttribute('href', '/nyetableringer')
        expect(screen.getByRole('link', { name: /Utforsk datagrunnlaget/i })).toHaveAttribute('href', '/utforsk')
    })

    it('falls back to overview copy when bankruptcy count and accounting totals are unavailable', () => {
        vi.mocked(useStatsQuery).mockReturnValue({
            data: {
                total_companies: 1140000,
                total_accounting_reports: undefined,
                total_revenue: 0,
                total_ebitda: 0,
                total_employees: 0,
                profitable_percentage: 0,
                solid_company_percentage: 0,
                avg_operating_margin: 0,
                new_companies_ytd: undefined,
                new_companies_30d: 1600,
                bankruptcies: undefined,
                geocoded_count: 1100000,
                total_roles: 0,
                avg_board_age: 0,
            },
            isLoading: false,
        } as unknown as ReturnType<typeof useStatsQuery>)

        render(<LiveDataPanel />)

        expect(screen.getByText('Se oversikt')).toBeInTheDocument()
        expect(screen.getByText('Søkbar datadekning')).toBeInTheDocument()
        expect(screen.getByText('Antall virksomheter som inngår i søk og analyse.')).toBeInTheDocument()
    })
})