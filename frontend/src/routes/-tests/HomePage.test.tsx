import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomePage } from '../index.lazy'
import { useFavoritesStore } from '../../store/favoritesStore'
import { useFilterStore } from '../../store/filterStore'
import { useCompanySearchQuery } from '../../hooks/queries/useCompanySearchQuery'
import { usePersonSearchQuery } from '../../hooks/queries/usePersonSearchQuery'
import { useStatsQuery } from '../../hooks/queries/useStatsQuery'
import { useUiStore } from '../../store/uiStore'

vi.mock('../../components/layout', () => ({
    SEOHead: () => <div data-testid="seo-head" />,
}))

vi.mock('../../store/uiStore', () => ({
    useUiStore: vi.fn(),
}))
vi.mock('../../store/filterStore', () => ({
    useFilterStore: vi.fn(),
}))
vi.mock('../../store/favoritesStore', () => ({
    useFavoritesStore: vi.fn(),
}))
vi.mock('../../hooks/queries/useStatsQuery', () => ({
    useStatsQuery: vi.fn(),
}))
vi.mock('../../hooks/queries/useCompanySearchQuery', () => ({
    useCompanySearchQuery: vi.fn(),
}))
vi.mock('../../hooks/queries/usePersonSearchQuery', () => ({
    usePersonSearchQuery: vi.fn(),
}))

const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createLazyFileRoute: () => (config: any) => config,
    useNavigate: () => mockNavigate,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Link: ({ children, to }: any) => <a href={to}>{children}</a>,
}))

const statsResponse = {
    total_companies: 1_240_000,
    total_accounting_reports: 0,
    total_revenue: 0,
    total_ebitda: 0,
    total_employees: 0,
    profitable_percentage: 0,
    solid_company_percentage: 0,
    avg_operating_margin: 0,
    new_companies_ytd: 12_400,
    new_companies_30d: 1_240,
    bankruptcies: 0,
    geocoded_count: 930_000,
    total_roles: 6_400_000,
    avg_board_age: 0,
}

describe('HomePage', () => {
    const mockAddRecentSearch = vi.fn()
    const mockClearFilters = vi.fn()
    const mockClearRecentCompanies = vi.fn()
    const mockClearFavorites = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useUiStore).mockImplementation((selector: any) => selector({
            addRecentSearch: mockAddRecentSearch,
            recentSearches: [],
            recentCompanies: [],
            clearRecentCompanies: mockClearRecentCompanies,
        }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useFilterStore).mockImplementation((selector: any) => selector({
            clearFilters: mockClearFilters,
        }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useFavoritesStore).mockImplementation((selector: any) => selector({
            favorites: [],
            clearFavorites: mockClearFavorites,
        }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useStatsQuery).mockReturnValue({ data: statsResponse, isLoading: false } as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useCompanySearchQuery).mockReturnValue({ data: [], isFetching: false } as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(usePersonSearchQuery).mockReturnValue({ data: [], isFetching: false } as any)
    })

    it('renders the redesigned landing sections', () => {
        render(<HomePage />)

        expect(screen.getByTestId('seo-head')).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: /Finn og sammenlign norske virksomheter/i })).toBeInTheDocument()
        expect(screen.getByRole('search')).toBeInTheDocument()
        expect(screen.getByRole('combobox', { name: /Søk etter virksomhet eller person/i })).toBeInTheDocument()
        expect(screen.getByText(/Roller og personer/i)).toBeInTheDocument()
        expect(screen.getByRole('heading', { name: /Utforsk næringslivet fra flere vinkler/i })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Personer/i })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Bransjer/i })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Kart/i })).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Regioner/i })).toBeInTheDocument()
    })

    it('handles company search and navigation', () => {
        render(<HomePage />)

        const input = screen.getByRole('combobox', { name: /Søk etter virksomhet eller person/i })
        const searchButton = screen.getByRole('button', { name: /Søk etter virksomhet/i })

        fireEvent.change(input, { target: { value: 'Test Company' } })
        fireEvent.click(searchButton)

        expect(mockClearFilters).toHaveBeenCalled()
        expect(mockAddRecentSearch).toHaveBeenCalledWith('Test Company')
        expect(mockNavigate).toHaveBeenCalledWith({
            to: '/utforsk',
            search: { q: 'Test Company' },
        })
    })

    it('navigates directly to orgnr when 9-digit number is entered', () => {
        render(<HomePage />)

        const input = screen.getByRole('combobox', { name: /Søk etter virksomhet eller person/i })
        const searchButton = screen.getByRole('button', { name: /Søk etter virksomhet/i })

        fireEvent.change(input, { target: { value: '993144169' } })
        fireEvent.click(searchButton)

        expect(mockNavigate).toHaveBeenCalledWith({
            to: '/virksomhet/$orgnr',
            params: { orgnr: '993144169' },
        })
    })

    it('handles person search mode navigation', () => {
        render(<HomePage />)

        fireEvent.click(screen.getByRole('button', { name: /Personer/i }))

        const input = screen.getByRole('combobox', { name: /Søk etter virksomhet eller person/i })
        const searchButton = screen.getByRole('button', { name: /Søk etter person/i })

        fireEvent.change(input, { target: { value: 'Ola Nordmann' } })
        fireEvent.click(searchButton)

        expect(mockNavigate).toHaveBeenCalledWith({
            to: '/person',
            search: { tab: 'sok', q: 'Ola Nordmann' },
        })
    })

    it('falls back to searchable coverage when accounting metrics are missing', () => {
        vi.mocked(useStatsQuery).mockReturnValue({
            data: {
                ...statsResponse,
                new_companies_ytd: undefined,
                total_accounting_reports: undefined,
            },
            isLoading: false,
        } as unknown as ReturnType<typeof useStatsQuery>)

        render(<HomePage />)

        expect(screen.getByText(/Søkbar datadekning/i)).toBeInTheDocument()
        expect(screen.getByText(/Antall virksomheter som inngår i søk, sammenligning og analyse/i)).toBeInTheDocument()
        expect(screen.queryByText(/^Regnskapsrapporter$/i)).not.toBeInTheDocument()
    })

    it('hides personal sections when favorites and recent companies are empty', () => {
        render(<HomePage />)

        expect(screen.queryByRole('heading', { name: /Fortsett der du slapp/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: /Dine favoritter/i })).not.toBeInTheDocument()
        expect(screen.queryByRole('heading', { name: /Nylig besøkte virksomheter/i })).not.toBeInTheDocument()
    })
})