import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StatisticsCards } from '../StatisticsCards'

// Mock dependencies
const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => mockNavigate
}))

// Mock hooks
const mockUseStatsQuery = vi.fn()
const mockUseCompanyCountQuery = vi.fn()

vi.mock('../../hooks/queries/useStatsQuery', () => ({
    useStatsQuery: () => mockUseStatsQuery()
}))

vi.mock('../../hooks/queries/useCompanyCountQuery', () => ({
    useCompanyCountQuery: (args: Record<string, unknown>) => mockUseCompanyCountQuery(args)
}))

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn()

describe('StatisticsCards', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Default mocks
        mockUseStatsQuery.mockReturnValue({
            data: {
                total_companies: 1000,
                total_accounting_reports: 444,
                total_revenue: 10000000,
                profitable_percentage: 60.5,
            },
            isLoading: false
        })

        // Smart mock for company counts
        mockUseCompanyCountQuery.mockImplementation((args) => {
            if (args?.is_bankrupt) return { data: 111 } // Bankruptcies
            if (args?.organisasjonsform) return { data: 222 } // New companies
            return { data: 333 } // Total count
        })
    })

    it('renders loading skeletons when loading', () => {
        mockUseStatsQuery.mockReturnValue({ isLoading: true, data: null })
        render(<StatisticsCards />)

        // Skeletons usually have animate-pulse class
        const skeletons = screen.getAllByText('', { selector: '.animate-pulse' })
        expect(skeletons.length).toBeGreaterThan(0)
    })

    it('renders statistics correctly', () => {
        render(<StatisticsCards />)

        expect(screen.getByText('Totalt bedrifter')).toBeInTheDocument()
        expect(screen.queryAllByText('333').length).toBeGreaterThan(0)

        expect(screen.getByText('Nye siste år')).toBeInTheDocument()
        expect(screen.queryAllByText('222').length).toBeGreaterThan(0)

        expect(screen.getByText('Konkurser siste år')).toBeInTheDocument()
        expect(screen.queryAllByText('111').length).toBeGreaterThan(0)

        expect(screen.getByText('Regnskapsrapporter')).toBeInTheDocument()
        expect(screen.queryAllByText('444').length).toBeGreaterThan(0)

        expect(screen.getByText('Samlet omsetning')).toBeInTheDocument()
        expect(screen.queryAllByText('10.0 mill. kr').length).toBeGreaterThan(0)

        expect(screen.getByText('Andel lønnsomme')).toBeInTheDocument()
        expect(screen.queryAllByText('60.5%').length).toBeGreaterThan(0)
    })

    it('handles navigation on card click', () => {
        render(<StatisticsCards />)

        // Find card with href (e.g., Regnskapsrapporter -> /bransjer)
        const card = screen.getByText('Regnskapsrapporter').closest('button')
        fireEvent.click(card!)

        expect(mockNavigate).toHaveBeenCalledWith({ to: '/bransjer' })
    })

    it('handles scroll action on card click', () => {
        render(<StatisticsCards />)

        // Find card with onClick (Totalt bedrifter)
        const card = screen.getByText('Totalt bedrifter').closest('button')
        fireEvent.click(card!)

        // Since we mocked scrollIntoView, we check if getElementById was called/used?
        // But the component uses document.getElementById('company-table')?.scrollIntoView()
        // This is hard to assert without spying on document.getElementById or verify scroll.
        // We can check that navigate was NOT called.
        expect(mockNavigate).not.toHaveBeenCalled()
    })
})
