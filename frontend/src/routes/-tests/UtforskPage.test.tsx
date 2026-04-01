import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UtforskPage } from '../utforsk.lazy'
import { useUiStore } from '../../store/uiStore'
import { useExplorerStore } from '../../store/explorerStore'
import { useFilterStore } from '../../store/filterStore'
import { useCompaniesQuery } from '../../hooks/queries/useCompaniesQuery'
import { useCompanyStatsQuery } from '../../hooks/queries/useCompanyStatsQuery'

// Mock components
vi.mock('../../components/layout', () => ({ SEOHead: () => <div />, Breadcrumbs: () => <div /> }))
vi.mock('../../components/FilterPanel', () => ({ FilterPanel: () => <div data-testid="filter-panel" /> }))
vi.mock('../../components/CompanyList', () => ({ CompanyList: () => <div data-testid="company-list" /> }))
vi.mock('../../components/common', () => ({ Pagination: () => <div data-testid="pagination" />, SearchTypeNav: () => <div /> }))
vi.mock('../../components/explorer', () => ({
    ExportButton: () => <button>Export</button>,
    ViewModeToggle: () => <div />
}))
vi.mock('../../components/explorer/ExplorerSearchBar', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ExplorerSearchBar: ({ onSearch }: any) => (
        <input data-testid="search-bar" onChange={(e) => onSearch(e.target.value)} />
    )
}))
vi.mock('../../components/ads/AffiliateBanner', () => ({ AffiliateBanner: () => <div /> }))

// Mock hooks & stores
vi.mock('../../store/uiStore', () => ({
    useUiStore: vi.fn()
}))
vi.mock('../../store/explorerStore', () => ({
    useExplorerStore: vi.fn()
}))
vi.mock('../../store/filterStore', () => ({
    useFilterStore: vi.fn()
}))
vi.mock('../../hooks/queries/useCompaniesQuery', () => ({
    useCompaniesQuery: vi.fn()
}))
vi.mock('../../hooks/queries/useCompanyStatsQuery', () => ({
    useCompanyStatsQuery: vi.fn()
}))
vi.mock('../../hooks/useFilterParams', () => ({
    useFilterParams: () => ({ filterParams: {}, sortBy: 'revenue', sortOrder: 'desc' })
}))
vi.mock('../../hooks/useSlowLoadingToast', () => ({
    useSlowLoadingToast: vi.fn()
}))

// Mock router
const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createLazyFileRoute: () => (config: any) => ({
        useNavigate: () => mockNavigate,
        useSearch: () => ({ q: 'initial query' }),
        ...config
    }),
    useNavigate: () => mockNavigate,
    useSearch: () => ({ q: 'initial query' }),
    useLocation: () => ({ pathname: '/utforsk' }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Link: ({ children }: any) => <a>{children}</a>
}))

describe('UtforskPage', () => {
    const mockSetSearchQuery = vi.fn()
    const mockSetPage = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        const mockState = {
            itemsPerPage: 20,
            currentPage: 1,
            addRecentSearch: vi.fn(),
            setPage: mockSetPage
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useUiStore).mockImplementation((selector?: any) =>
            selector ? selector(mockState) : mockState
        )
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useExplorerStore).mockImplementation((selector: any) => selector({ viewMode: 'list' }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useFilterStore).mockImplementation((selector: any) => selector({
            setSearchQuery: mockSetSearchQuery,
            setSort: vi.fn()
        }))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useCompaniesQuery).mockReturnValue({ data: [{ orgnr: '123' }], isLoading: false } as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        vi.mocked(useCompanyStatsQuery).mockReturnValue({ data: { total_count: 100 }, isLoading: false } as any)
    })

    it('renders and syncs initial search query from URL', () => {
        render(<UtforskPage />)
        expect(mockSetSearchQuery).toHaveBeenCalledWith('initial query')
        expect(screen.getByTestId('filter-panel')).toBeInTheDocument()
        expect(screen.getByTestId('company-list')).toBeInTheDocument()
    })

    it('handles search input change and navigates', () => {
        render(<UtforskPage />)
        const searchInput = screen.getByTestId('search-bar')
        fireEvent.change(searchInput, { target: { value: 'new query' } })

        expect(mockNavigate).toHaveBeenCalledWith({
            to: '/utforsk',
            search: { q: 'new query' }
        })
    })

    it('handles orgnr search and navigates directly', () => {
        render(<UtforskPage />)
        const searchInput = screen.getByTestId('search-bar')
        fireEvent.change(searchInput, { target: { value: '993144169' } })

        expect(mockNavigate).toHaveBeenCalledWith({
            to: '/virksomhet/$orgnr',
            params: { orgnr: '993144169' }
        })
    })
})
