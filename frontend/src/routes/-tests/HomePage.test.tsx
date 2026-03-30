import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { HomePage } from '../index.lazy'
import { useUiStore } from '../../store/uiStore'
import { useFilterStore } from '../../store/filterStore'
import { usePersonSearchQuery } from '../../hooks/queries/usePersonSearchQuery'

// Mock components
vi.mock('../../components/StatisticsCards', () => ({
    StatisticsCards: () => <div data-testid="statistics-cards" />
}))
vi.mock('../../components/ExplorerCTA', () => ({
    ExplorerCTA: () => <div data-testid="explorer-cta" />
}))
vi.mock('../../components/FavoritesSection', () => ({
    FavoritesSection: () => <div data-testid="favorites-section" />
}))
vi.mock('../../components/RecentCompanies', () => ({
    RecentCompanies: () => <div data-testid="recent-companies" />
}))
vi.mock('../../components/RecentSearches', () => ({
    RecentSearches: () => <div data-testid="recent-searches" />
}))
vi.mock('../../components/layout', () => ({
    SEOHead: () => <div data-testid="seo-head" />
}))

// Mock stores & hooks
vi.mock('../../store/uiStore', () => ({
    useUiStore: vi.fn()
}))
vi.mock('../../store/filterStore', () => ({
    useFilterStore: vi.fn()
}))
vi.mock('../../hooks/queries/usePersonSearchQuery', () => ({
    usePersonSearchQuery: vi.fn()
}))

// Mock router
const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createLazyFileRoute: () => (config: any) => config,
    useNavigate: () => mockNavigate,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Link: ({ children }: any) => <a>{children}</a>
}))

describe('HomePage', () => {
    const mockAddRecentSearch = vi.fn()
    const mockClearFilters = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useUiStore).mockImplementation((selector: any) => selector({
            addRecentSearch: mockAddRecentSearch,
            recentSearches: []
        }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useFilterStore).mockImplementation((selector: any) => selector({ clearFilters: mockClearFilters }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(usePersonSearchQuery).mockReturnValue({ data: [], isFetching: false } as any)
    })

    it('renders the core sections', () => {
        render(<HomePage />)
        expect(screen.getByTestId('statistics-cards')).toBeInTheDocument()
        expect(screen.getByTestId('explorer-cta')).toBeInTheDocument()
        expect(screen.getByTestId('recent-searches')).toBeInTheDocument()
        expect(screen.getByText(/Virksomheter/i)).toBeInTheDocument()
    })

    it('handles company search and navigation', () => {
        render(<HomePage />)
        const input = screen.getByPlaceholderText(/Søk etter virksomhet/i)
        const searchButton = screen.getByRole('button', { name: /Søk/i })

        fireEvent.change(input, { target: { value: 'Test Company' } })
        fireEvent.click(searchButton)

        expect(mockClearFilters).toHaveBeenCalled()
        expect(mockAddRecentSearch).toHaveBeenCalledWith('Test Company')
        expect(mockNavigate).toHaveBeenCalledWith({
            to: '/utforsk',
            search: { q: 'Test Company' }
        })
    })

    it('navigates directly to orgnr when 9-digit number is entered', () => {
        render(<HomePage />)
        const input = screen.getByPlaceholderText(/Søk etter virksomhet/i)
        const searchButton = screen.getByRole('button', { name: /Søk/i })

        fireEvent.change(input, { target: { value: '993144169' } })
        fireEvent.click(searchButton)

        expect(mockNavigate).toHaveBeenCalledWith({
            to: '/virksomhet/$orgnr',
            params: { orgnr: '993144169' }
        })
    })

    it('switches to person search mode', () => {
        render(<HomePage />)
        const personButton = screen.getByText(/Personer/i)

        fireEvent.click(personButton)

        expect(screen.getByPlaceholderText(/Søk etter navn på person/i)).toBeInTheDocument()
    })
})
