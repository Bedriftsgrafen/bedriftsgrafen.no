/**
 * MECE Unit Tests for RolesTab Component
 *
 * Test Categories:
 * 1. Helper Functions - formatDate, groupRoles, getRoleConfig
 * 2. RoleCard Component - Rendering and interactions
 * 3. RolesTab Component - Loading, error, empty, and data states
 * 4. Person Profile Link - Navigation integration
 */

import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Mock TanStack Router Link component
vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, ...props }: { children: ReactNode;[key: string]: unknown }) => (
        <a href="#" data-testid="mock-link" {...props}>{children}</a>
    ),
}))

// Mock useRolesQuery hook
vi.mock('../../../hooks/queries/useRolesQuery', () => ({
    useRolesQuery: vi.fn(),
}))

import { useRolesQuery } from '../../../hooks/queries/useRolesQuery'
import { RolesTab } from '../RolesTab'

const mockUseRolesQuery = useRolesQuery as ReturnType<typeof vi.fn>

// Sample role data
const mockRoles = [
    {
        type_kode: 'DAGL',
        type_beskrivelse: 'Daglig leder',
        person_navn: 'Ola Nordmann',
        foedselsdato: '1980-05-15',
        enhet_orgnr: null,
        enhet_navn: null,
        fratraadt: false,
        rekkefoelge: 1,
    },
    {
        type_kode: 'LEDE',
        type_beskrivelse: 'Styreleder',
        person_navn: 'Kari Nordmann',
        foedselsdato: null,
        enhet_orgnr: null,
        enhet_navn: null,
        fratraadt: false,
        rekkefoelge: null,
    },
    {
        type_kode: 'REVI',
        type_beskrivelse: 'Revisor',
        person_navn: null,
        enhet_orgnr: '987654321',
        enhet_navn: 'Revisorselskap AS',
        fratraadt: false,
        rekkefoelge: null,
    },
]

// Test wrapper with query client only (router mocking handled by vi.mock)
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
describe('RolesTab - Loading State', () => {
    it('shows loading spinner when fetching', () => {
        mockUseRolesQuery.mockReturnValue({
            data: undefined,
            isLoading: true,
            isError: false,
            error: null,
            fetchFromBrreg: vi.fn(),
        })

        render(<RolesTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        expect(screen.getByText('Laster roller...')).toBeInTheDocument()
    })
})

// ============================================================================
// Category 2: Error State
// ============================================================================
describe('RolesTab - Error State', () => {
    it('shows error message when fetch fails', () => {
        mockUseRolesQuery.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
            error: new Error('Network error'),
            fetchFromBrreg: vi.fn(),
        })

        render(<RolesTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        expect(screen.getByText('Kunne ikke laste roller')).toBeInTheDocument()
        expect(screen.getByText('Network error')).toBeInTheDocument()
    })

    it('shows retry button in error state', () => {
        const mockFetch = vi.fn()
        mockUseRolesQuery.mockReturnValue({
            data: undefined,
            isLoading: false,
            isError: true,
            error: new Error('Failed'),
            fetchFromBrreg: mockFetch,
        })

        render(<RolesTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        const retryButton = screen.getByText('Prøv igjen')
        expect(retryButton).toBeInTheDocument()
    })
})

// ============================================================================
// Category 3: Empty State
// ============================================================================
describe('RolesTab - Empty State', () => {
    it('shows empty message when no roles exist', () => {
        mockUseRolesQuery.mockReturnValue({
            data: [],
            isLoading: false,
            isError: false,
            error: null,
            fetchFromBrreg: vi.fn(),
        })

        render(<RolesTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        expect(screen.getByText('Ingen roller funnet')).toBeInTheDocument()
    })

    it('shows fetch from Brønnøysund button when empty', () => {
        mockUseRolesQuery.mockReturnValue({
            data: [],
            isLoading: false,
            isError: false,
            error: null,
            fetchFromBrreg: vi.fn(),
        })

        render(<RolesTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        expect(screen.getByText('Hent fra Brønnøysund')).toBeInTheDocument()
    })
})

// ============================================================================
// Category 4: Data Display
// ============================================================================
describe('RolesTab - Data Display', () => {
    beforeEach(() => {
        mockUseRolesQuery.mockReturnValue({
            data: mockRoles,
            isLoading: false,
            isError: false,
            error: null,
            fetchFromBrreg: vi.fn(),
        })
    })

    it('displays role count', () => {
        render(<RolesTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        // 3 active roles
        expect(screen.getByText('3 roller')).toBeInTheDocument()
    })

    it('displays person names', () => {
        render(<RolesTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        expect(screen.getByText('Ola Nordmann')).toBeInTheDocument()
        expect(screen.getByText('Kari Nordmann')).toBeInTheDocument()
    })

    it('displays role descriptions', () => {
        render(<RolesTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        expect(screen.getByText('Daglig leder')).toBeInTheDocument()
        // 'Styreleder' appears as header and description, so we check for both
        expect(screen.getAllByText('Styreleder')).toHaveLength(2)
    })

    it('displays entity name for non-person roles', () => {
        render(<RolesTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        expect(screen.getByText('Revisorselskap AS')).toBeInTheDocument()
    })
})

// ============================================================================
// Category 5: Role Card Expansion
// ============================================================================
describe('RolesTab - Role Card Expansion', () => {
    beforeEach(() => {
        mockUseRolesQuery.mockReturnValue({
            data: mockRoles,
            isLoading: false,
            isError: false,
            error: null,
            fetchFromBrreg: vi.fn(),
        })
    })

    it('expands role card on click', () => {
        const mockOnCompanyClick = vi.fn()
        render(<RolesTab orgnr="123456789" onCompanyClick={mockOnCompanyClick} />, { wrapper: createTestWrapper() })

        // Initially, birthdate should not be visible
        expect(screen.queryByText(/Født:/)).not.toBeInTheDocument()

        // Click on Ola Nordmann's card
        const olaCard = screen.getByText('Ola Nordmann').closest('div[class*="cursor-pointer"]')
        if (olaCard) {
            fireEvent.click(olaCard)
        }

        // Now birthdate should be visible
        expect(screen.getByText(/Født:/)).toBeInTheDocument()
    })

    it('shows person profile link when expanded', () => {
        const mockOnCompanyClick = vi.fn()
        render(<RolesTab orgnr="123456789" onCompanyClick={mockOnCompanyClick} />, { wrapper: createTestWrapper() })

        // Click on Ola Nordmann's card
        const olaCard = screen.getByText('Ola Nordmann').closest('div[class*="cursor-pointer"]')
        if (olaCard) {
            fireEvent.click(olaCard)
        }

        // Should show link to person profile
        expect(screen.getByText(/Se alle roller/)).toBeInTheDocument()
    })
})

// ============================================================================
// Category 6: Refresh Action
// ============================================================================
describe('RolesTab - Refresh Action', () => {
    it('calls fetchFromBrreg when refresh button clicked', async () => {
        const mockFetch = vi.fn().mockResolvedValue(undefined)
        mockUseRolesQuery.mockReturnValue({
            data: mockRoles,
            isLoading: false,
            isError: false,
            error: null,
            fetchFromBrreg: mockFetch,
        })

        render(<RolesTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        const refreshButton = screen.getByTitle('Oppdater fra Brønnøysund')
        fireEvent.click(refreshButton)

        await waitFor(() => expect(mockFetch).toHaveBeenCalled())

        // Wait for the async state updates (cooldown) to finish to avoid "act" warnings
        await waitFor(() => expect(screen.getByTitle('Nylig oppdatert')).toBeInTheDocument())
    })
})

// ============================================================================
// Category 7: Role Grouping Logic
// ============================================================================
describe('RolesTab - Role Grouping', () => {
    it('groups roles by type and shows section headers', () => {
        mockUseRolesQuery.mockReturnValue({
            data: mockRoles,
            isLoading: false,
            isError: false,
            error: null,
            fetchFromBrreg: vi.fn(),
        })

        render(<RolesTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        // Should have section headers for different role types
        expect(screen.getByText('Daglig ledelse')).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 4, name: /Styreleder/ })).toBeInTheDocument()
        expect(screen.getByRole('heading', { level: 4, name: /Revisor/ })).toBeInTheDocument()
    })

    it('excludes resigned roles from display', () => {
        const rolesWithResigned = [
            ...mockRoles,
            {
                type_kode: 'MEDL',
                type_beskrivelse: 'Styremedlem',
                person_navn: 'Resigned Person',
                foedselsdato: null,
                enhet_orgnr: null,
                enhet_navn: null,
                fratraadt: true, // Resigned!
                rekkefoelge: null,
            },
        ]

        mockUseRolesQuery.mockReturnValue({
            data: rolesWithResigned,
            isLoading: false,
            isError: false,
            error: null,
            fetchFromBrreg: vi.fn(),
        })

        render(<RolesTab orgnr="123456789" />, { wrapper: createTestWrapper() })

        // Resigned person should not be displayed
        expect(screen.queryByText('Resigned Person')).not.toBeInTheDocument()
        // Count should still be 3 (not 4)
        expect(screen.getByText('3 roller')).toBeInTheDocument()
    })
})
