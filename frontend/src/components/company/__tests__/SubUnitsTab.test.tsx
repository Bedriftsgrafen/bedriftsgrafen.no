/**
 * MECE Unit Tests for SubUnitsTab Component
 *
 * Test Categories:
 * 1. Loading State - When data is being fetched.
 * 2. Error State - When fetching fails.
 * 3. Empty State - When no subunits are returned.
 * 4. Data Display - When subunits are successfully fetched and rendered.
 * 5. Refresh Action - When user manually triggers a fetch from Brønnøysund.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Mock useSubUnitsQuery hook
vi.mock('../../../hooks/queries/useSubUnitsQuery', () => ({
    useSubUnitsQuery: vi.fn(),
}))

import { useSubUnitsQuery } from '../../../hooks/queries/useSubUnitsQuery'
import { SubUnitsTab } from '../SubUnitsTab'
import type { SubUnit } from '../../../types'

const mockUseSubUnitsQuery = useSubUnitsQuery as ReturnType<typeof vi.fn>

// Sample subunit data
const mockSubUnits: SubUnit[] = [
    {
        orgnr: '987654321',
        navn: 'Avdeling A',
        organisasjonsform: 'BEDR',
        naeringskode: '10.710',
        antall_ansatte: 10,
        beliggenhetsadresse: {
            adresse: ['Storgata 1'],
            postnummer: '0101',
            poststed: 'OSLO',
            kommune: 'OSLO',
            land: 'Norge',
        },
        stiftelsesdato: '2020-01-01',
    },
    {
        orgnr: '123456780',
        navn: 'Avdeling B',
        organisasjonsform: 'BEDR',
        naeringskode: '47.110',
        antall_ansatte: 5,
        beliggenhetsadresse: {
            adresse: ['Langgata 2'],
            postnummer: '5003',
            poststed: 'BERGEN',
            kommune: 'BERGEN',
            land: 'Norge',
        },
        stiftelsesdato: '2021-06-15',
    },
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

beforeEach(() => {
    vi.clearAllMocks()
})

// ============================================================================
// Category 1: Loading State
// ============================================================================
describe('SubUnitsTab - Loading State', () => {
    it('shows loading spinner when fetching', () => {
        mockUseSubUnitsQuery.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false,
            error: null,
            fetchFromBrreg: vi.fn(),
        })

        render(<SubUnitsTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        expect(screen.getByText('Laster avdelinger...')).toBeInTheDocument()
    })
})

// ============================================================================
// Category 2: Error State
// ============================================================================
describe('SubUnitsTab - Error State', () => {
    it('shows error message when fetch fails', () => {
        mockUseSubUnitsQuery.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
            error: new Error('Network error'),
            fetchFromBrreg: vi.fn(),
        })

        render(<SubUnitsTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        expect(screen.getByText('Kunne ikke laste avdelinger')).toBeInTheDocument()
        expect(screen.getByText('Network error')).toBeInTheDocument()
    })

    it('shows retry button in error state and calls fetch on click', async () => {
        const mockFetch = vi.fn()
        mockUseSubUnitsQuery.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
            error: new Error('Failed'),
            fetchFromBrreg: mockFetch,
        })

        render(<SubUnitsTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        const retryButton = screen.getByText('Prøv igjen')
        expect(retryButton).toBeInTheDocument()
        fireEvent.click(retryButton)

        await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    })
})

// ============================================================================
// Category 3: Empty State
// ============================================================================
describe('SubUnitsTab - Empty State', () => {
    it('shows empty message when no subunits exist', () => {
        mockUseSubUnitsQuery.mockReturnValue({
            data: [],
            isLoading: false,
            isError: false,
            error: null,
            fetchFromBrreg: vi.fn(),
        })

        render(<SubUnitsTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        expect(screen.getByText('Ingen avdelinger funnet')).toBeInTheDocument()
    })

    it('shows fetch from Brønnøysund button when empty and calls fetch on click', async () => {
        const mockFetch = vi.fn()
        mockUseSubUnitsQuery.mockReturnValue({
            data: [],
            isLoading: false,
            isError: false,
            error: null,
            fetchFromBrreg: mockFetch,
        })

        render(<SubUnitsTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        const fetchButton = screen.getByText('Hent fra Brønnøysund')
        expect(fetchButton).toBeInTheDocument()
        fireEvent.click(fetchButton)
        
        await waitFor(() => expect(mockFetch).toHaveBeenCalled())
    })
})

// ============================================================================
// Category 4: Data Display
// ============================================================================
describe('SubUnitsTab - Data Display', () => {
    beforeEach(() => {
        mockUseSubUnitsQuery.mockReturnValue({
            data: mockSubUnits,
            isLoading: false,
            isError: false,
            error: null,
            fetchFromBrreg: vi.fn(),
        })
    })

    it('displays the correct count of subunits', () => {
        render(<SubUnitsTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        expect(screen.getByText('2 avdelinger')).toBeInTheDocument()
    })

    it('renders subunit names', () => {
        render(<SubUnitsTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        expect(screen.getByText('Avdeling A')).toBeInTheDocument()
        expect(screen.getByText('Avdeling B')).toBeInTheDocument()
    })

    it('renders subunit employee count', () => {
        render(<SubUnitsTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        expect(screen.getByText('10 ansatte')).toBeInTheDocument()
        expect(screen.getByText('5 ansatte')).toBeInTheDocument()
    })

    it('renders the stiftelsesdato (foundation date)', () => {
        render(<SubUnitsTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        // Check for formatted date string
        expect(screen.getByText(`Opprettet: ${new Date('2020-01-01').toLocaleDateString('no-NO')}`)).toBeInTheDocument()
        expect(screen.getByText(`Opprettet: ${new Date('2021-06-15').toLocaleDateString('no-NO')}`)).toBeInTheDocument()
    })
})

// ============================================================================
// Category 5: Search Functionality
// ============================================================================
describe('SubUnitsTab - Search Functionality', () => {
    beforeEach(() => {
        mockUseSubUnitsQuery.mockReturnValue({
            data: mockSubUnits,
            isLoading: false,
            isError: false,
            error: null,
            fetchFromBrreg: vi.fn(),
        })
    })

    it('filters subunits by name', () => {
        render(<SubUnitsTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        const searchInput = screen.getByPlaceholderText(/Søk i avdelinger/)
        fireEvent.change(searchInput, { target: { value: 'Avdeling A' } })

        expect(screen.getByText('Avdeling A')).toBeInTheDocument()
        expect(screen.queryByText('Avdeling B')).not.toBeInTheDocument()
        expect(screen.getByText('(1 treff)')).toBeInTheDocument()
    })

    it('filters subunits by city (poststed)', () => {
        render(<SubUnitsTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        const searchInput = screen.getByPlaceholderText(/Søk i avdelinger/)
        fireEvent.change(searchInput, { target: { value: 'BERGEN' } })

        expect(screen.queryByText('Avdeling A')).not.toBeInTheDocument()
        expect(screen.getByText('Avdeling B')).toBeInTheDocument()
    })

    it('filters subunits by orgnr', () => {
        render(<SubUnitsTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        const searchInput = screen.getByPlaceholderText(/Søk i avdelinger/)
        fireEvent.change(searchInput, { target: { value: '123456780' } })

        expect(screen.queryByText('Avdeling A')).not.toBeInTheDocument()
        expect(screen.getByText('Avdeling B')).toBeInTheDocument()
    })

    it('shows empty state when no matches found', () => {
        render(<SubUnitsTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        const searchInput = screen.getByPlaceholderText(/Søk i avdelinger/)
        fireEvent.change(searchInput, { target: { value: 'Non-existent' } })

        expect(screen.getByText(/Ingen avdelinger matchet søket "Non-existent"/)).toBeInTheDocument()
        expect(screen.queryByText('Avdeling A')).not.toBeInTheDocument()
        expect(screen.queryByText('Avdeling B')).not.toBeInTheDocument()
    })
})