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
                total_roles: 6400000,
                geocoded_count: 850,
                total_ebitda: 5000000,
                new_companies_30d: 120,
                solid_company_percentage: 65.4,
            },
            isLoading: false
        })

        mockUseCompanyCountQuery.mockReturnValue({ data: 1000 })
    })

    it('renders loading skeletons when loading', () => {
        mockUseStatsQuery.mockReturnValue({ isLoading: true, data: null })
        render(<StatisticsCards />)

        const skeletons = screen.getAllByText('', { selector: '.animate-pulse' })
        expect(skeletons.length).toBeGreaterThan(0)
    })

    it('renders statistics correctly', () => {
        render(<StatisticsCards />)

        expect(screen.getByText('Bedriftspopulasjonen')).toBeInTheDocument()
        expect(screen.getByText('1.0 k')).toBeInTheDocument()

        expect(screen.getByText('Næringslivets Roller')).toBeInTheDocument()
        expect(screen.getByText('6.4 mill.')).toBeInTheDocument()

        expect(screen.getByText('Geografisk Innsikt')).toBeInTheDocument()
        expect(screen.getByText('85.0%')).toBeInTheDocument()

        expect(screen.getByText('Verdiskaping')).toBeInTheDocument()
        expect(screen.getByText('5.0 mill. kr')).toBeInTheDocument()

        expect(screen.getByText('Næringslivets Puls')).toBeInTheDocument()
        expect(screen.getByText('120')).toBeInTheDocument()

        expect(screen.getByText('Finansiell Robusthet')).toBeInTheDocument()
        expect(screen.getByText('65.4%')).toBeInTheDocument()
    })

    it('handles navigation on card click', () => {
        render(<StatisticsCards />)

        // Find card with href (e.g., Verdiskaping -> /bransjer)
        const card = screen.getByText('Verdiskaping').closest('button')
        fireEvent.click(card!)

        expect(mockNavigate).toHaveBeenCalledWith({ to: '/bransjer' })
    })

    it('handles scroll action or click behavior on special cards', () => {
        render(<StatisticsCards />)

        // Find card with onClick (Bedriftspopulasjonen)
        const card = screen.getByText('Bedriftspopulasjonen').closest('button')

        // Mock the elements that focusSearch tries to find
        const mockBtn = document.createElement('button')
        mockBtn.id = 'search-mode-company'
        document.body.appendChild(mockBtn)

        const mockInput = document.createElement('input')
        mockInput.id = 'home-search-input'
        document.body.appendChild(mockInput)

        fireEvent.click(card!)

        // Should NOT navigate
        expect(mockNavigate).not.toHaveBeenCalled()

        document.body.removeChild(mockBtn)
        document.body.removeChild(mockInput)
    })
})
