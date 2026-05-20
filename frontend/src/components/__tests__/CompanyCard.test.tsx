import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CompanyCard } from '../CompanyCard'
import { Company } from '../../types'

// Mock dependencies
vi.mock('../FavoriteButton', () => ({
    FavoriteButton: () => <button data-testid="favorite-btn">Favorite</button>
}))

vi.mock('../comparison', () => ({
    ComparisonButton: () => <button data-testid="comparison-btn">Compare</button>
}))

const mockCompany: Company = {
    orgnr: '123456789',
    navn: 'Test Virksomhet AS',
    organisasjonsform: 'AS',
    naeringskode: '62.010',
    antall_ansatte: 10,
    latest_revenue: 10000000,
    latest_profit: 1000000,
    latest_equity_ratio: 0.5,
    stiftelsesdato: '2020-01-01',
    naeringskoder: [],
    forretningsadresse: {
        adresse: ['Testveien 1'],
        postnummer: '0123',
        poststed: 'Oslo',
        kommune: 'Oslo',
        kommunenummer: '0301',
        land: 'Norge'
    }
}

describe('CompanyCard', () => {
    it('renders company basic information', () => {
        const onClick = vi.fn()
        render(<CompanyCard company={mockCompany} onClick={onClick} />)

        expect(screen.getByText('Test Virksomhet AS')).toBeInTheDocument()
        expect(screen.getByText('Org.nr: 123456789')).toBeInTheDocument()
        expect(screen.getByText('AS')).toBeInTheDocument()
        // Check for formatted numbers (1.0 M for 1000000)
        expect(screen.getByText('1.0 M')).toBeInTheDocument()
    })

    it('renders empty values gracefully', () => {
        const emptyCompany: Company = {
            ...mockCompany,
            navn: undefined,
            latest_revenue: null,
            latest_profit: null,
            antall_ansatte: undefined,
            postadresse: undefined,
            forretningsadresse: undefined
        }

        render(<CompanyCard company={emptyCompany} onClick={() => { }} />)

        expect(screen.getByText('Ukjent navn')).toBeInTheDocument()
        expect(screen.getAllByText('-').length).toBeGreaterThan(0) // Revenue, Profit, Employees all use '-'
    })

    it('handles click events', () => {
        const handleClick = vi.fn()
        render(<CompanyCard company={mockCompany} onClick={handleClick} />)

        const openButton = screen.getByRole('button', { name: /Åpne Test Virksomhet AS/i })
        fireEvent.click(openButton)
        expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('uses a dedicated open button instead of making the whole card a nested button container', () => {
        const handleClick = vi.fn()
        const { container } = render(<CompanyCard company={mockCompany} onClick={handleClick} />)

        const openButton = screen.getByRole('button', { name: /Åpne Test Virksomhet AS/i })
        expect(openButton).toBeInTheDocument()

        const root = container.firstChild as HTMLElement
        expect(root).not.toHaveAttribute('role', 'button')
    })

    it('exposes a focusable native open button for keyboard users', () => {
        render(<CompanyCard company={mockCompany} onClick={() => {}} />)

        const openButton = screen.getByRole('button', { name: /Åpne Test Virksomhet AS/i })
        openButton.focus()

        expect(openButton.tagName).toBe('BUTTON')
        expect(openButton).toHaveFocus()
    })

    describe('Smart Badges', () => {
        it('renders Solid badge for high equity ratio', () => {
            const solidCompany = { ...mockCompany, latest_equity_ratio: 0.25 }
            render(<CompanyCard company={solidCompany} onClick={() => { }} />)
            expect(screen.getByText('Solid')).toBeInTheDocument()
        })

        it('renders Ny badge for recently established companies', () => {
            const recentDate = new Date()
            recentDate.setMonth(recentDate.getMonth() - 2)
            const newCompany = { 
                ...mockCompany, 
                stiftelsesdato: recentDate.toISOString().split('T')[0] 
            }
            render(<CompanyCard company={newCompany} onClick={() => { }} />)
            expect(screen.getByText('Ny')).toBeInTheDocument()
        })

        it('renders Etablert badge for old companies', () => {
            const oldCompany = { 
                ...mockCompany, 
                stiftelsesdato: '1990-01-01' 
            }
            render(<CompanyCard company={oldCompany} onClick={() => { }} />)
            expect(screen.getByText('Etablert')).toBeInTheDocument()
        })

        it('renders multiple badges simultaneously', () => {
            const complexCompany = { 
                ...mockCompany, 
                latest_equity_ratio: 0.3,
                stiftelsesdato: '1980-01-01' 
            }
            render(<CompanyCard company={complexCompany} onClick={() => { }} />)
            expect(screen.getByText('Solid')).toBeInTheDocument()
            expect(screen.getByText('Etablert')).toBeInTheDocument()
        })
    })
})
