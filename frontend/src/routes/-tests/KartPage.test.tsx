/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KartPage } from '../kart'
import { useFilterStore } from '../../store/filterStore'

// Mock components
vi.mock('../../components/layout', () => ({ SEOHead: () => <div /> }))
vi.mock('../../components/company/CompanyModalOverlay', () => ({
    CompanyModalOverlay: () => <div data-testid="company-modal" />
}))
vi.mock('../../hooks/useDocumentTitle', () => ({
    useDocumentTitle: vi.fn()
}))
vi.mock('../../components/maps/MapGuide', () => ({
    MapGuide: () => <div data-testid="map-guide" />
}))
vi.mock('../../components/maps/IndustryMap', () => ({
     
    IndustryMap: ({ onFilterChange }: any) => (
        <div data-testid="industry-map">
            <button data-testid="change-county" onClick={() => onFilterChange({ countyCode: '03' })}>
                Change County
            </button>
        </div>
    )
}))

// Mock hooks & stores
vi.mock('../../store/filterStore', () => {
    const mockStore = vi.fn()
         
        ; (mockStore as any).setState = vi.fn()
         
        ; (mockStore as any).getState = () => ({ clearFilters: vi.fn() })
    return { useFilterStore: mockStore }
})
vi.mock('lucide-react', () => ({ Map: () => <div /> }))

// Mock router
const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
    createFileRoute: () => (config: any) => config,
    useNavigate: () => mockNavigate,
    useSearch: () => ({}),
    useLocation: () => ({ pathname: '/kart' }),
     
    Link: ({ children }: any) => <a>{children}</a>
}))

describe('KartPage', () => {
    const mockSetSearchQuery = vi.fn()
    const mockClearFilters = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        const state = {
            naeringskode: '',
            searchQuery: '',
            setSearchQuery: mockSetSearchQuery,
            clearFilters: mockClearFilters
        }
         
        vi.mocked(useFilterStore).mockImplementation((selector: any) =>
            selector ? selector(state) : state
        )
    })

    it('renders and displays map components', () => {
        render(<KartPage />)
        expect(screen.getByTestId('map-guide')).toBeInTheDocument()
        expect(screen.getByTestId('industry-map')).toBeInTheDocument()
    })

    it('handles filter changes and navigates', () => {
        render(<KartPage />)
        const changeButton = screen.getByTestId('change-county')
        fireEvent.click(changeButton)

        expect(useFilterStore.setState).toHaveBeenCalled()
        expect(mockNavigate).toHaveBeenCalled()
    })
})
