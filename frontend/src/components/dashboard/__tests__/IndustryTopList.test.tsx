import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { IndustryTopList } from '../IndustryTopList'
import { useCompaniesQuery } from '../../../hooks/queries/useCompaniesQuery'

// Mock useCompaniesQuery hook
vi.mock('../../../hooks/queries/useCompaniesQuery', () => ({
    useCompaniesQuery: vi.fn(),
}))

const mockUseCompaniesQuery = useCompaniesQuery as ReturnType<typeof vi.fn>

// Sample company data
const mockCompanies = [
    {
        orgnr: '123456789',
        navn: 'Company A',
        latest_revenue: 1000000,
        latest_profit: 100000,
        latest_operating_margin: 10,
        antall_ansatte: 50
    },
    {
        orgnr: '987654321',
        navn: 'Company B',
        latest_revenue: 500000,
        latest_profit: -50000,
        latest_operating_margin: -10,
        antall_ansatte: 20
    }
]

// Test wrapper with query client
function createTestWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })

    return function TestWrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )
    }
}

describe('IndustryTopList', () => {
    const mockOnSelectCompany = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('shows loading state when fetching', () => {
        mockUseCompaniesQuery.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false,
            refetch: vi.fn()
        })

        render(
            <IndustryTopList onSelectCompany={mockOnSelectCompany} />,
            { wrapper: createTestWrapper() }
        )

        expect(screen.getByText('Henter toppliste...')).toBeInTheDocument()
    })

    it('shows error state when fetch fails', () => {
        mockUseCompaniesQuery.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
            refetch: vi.fn()
        })

        render(
            <IndustryTopList onSelectCompany={mockOnSelectCompany} />,
            { wrapper: createTestWrapper() }
        )

        expect(screen.getByText('Kunne ikke laste toppliste')).toBeInTheDocument()
    })

    it('displays company data correctly', () => {
        mockUseCompaniesQuery.mockReturnValue({
            data: mockCompanies,
            isLoading: false,
            isError: false,
            refetch: vi.fn()
        })

        render(
            <IndustryTopList onSelectCompany={mockOnSelectCompany} />,
            { wrapper: createTestWrapper() }
        )

        expect(screen.getByText('Company A')).toBeInTheDocument()
        expect(screen.getByText('Company B')).toBeInTheDocument()
        expect(screen.getByText('123456789')).toBeInTheDocument()

        // Check financial formatting (approximate matches to handle potential local/nbsp variations)
        expect(screen.getByText(/1.*mill/)).toBeInTheDocument()
        expect(screen.getByText(/100.*000/)).toBeInTheDocument()
    })

    it('calls onSelectCompany when a row is clicked', () => {
        mockUseCompaniesQuery.mockReturnValue({
            data: mockCompanies,
            isLoading: false,
            isError: false,
            refetch: vi.fn()
        })

        render(
            <IndustryTopList onSelectCompany={mockOnSelectCompany} />,
            { wrapper: createTestWrapper() }
        )

        fireEvent.click(screen.getByText('Company A'))
        expect(mockOnSelectCompany).toHaveBeenCalledWith('123456789')
    })

    it('changes sort field when clicking a sortable header', () => {
        const mockRefetch = vi.fn()
        mockUseCompaniesQuery.mockReturnValue({
            data: mockCompanies,
            isLoading: false,
            isError: false,
            refetch: mockRefetch
        })

        render(
            <IndustryTopList onSelectCompany={mockOnSelectCompany} />,
            { wrapper: createTestWrapper() }
        )

        // Initially sorted by revenue (desc)
        expect(mockUseCompaniesQuery).toHaveBeenLastCalledWith(expect.objectContaining({
            sort_by: 'revenue',
            sort_order: 'desc'
        }))

        // Click on "Resultat" (profit)
        fireEvent.click(screen.getByText('Resultat'))

        // Should call hook with new sort
        expect(mockUseCompaniesQuery).toHaveBeenLastCalledWith(expect.objectContaining({
            sort_by: 'profit',
            sort_order: 'desc'
        }))
    })

    it('toggles sort order when clicking the same header', () => {
        mockUseCompaniesQuery.mockReturnValue({
            data: mockCompanies,
            isLoading: false,
            isError: false,
            refetch: vi.fn()
        })

        render(
            <IndustryTopList onSelectCompany={mockOnSelectCompany} />,
            { wrapper: createTestWrapper() }
        )

        // Click on "Omsetning" (already active)
        fireEvent.click(screen.getByText('Omsetning'))

        // Should toggle to asc
        expect(mockUseCompaniesQuery).toHaveBeenLastCalledWith(expect.objectContaining({
            sort_by: 'revenue',
            sort_order: 'asc'
        }))
    })
})
