/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { KartPage } from '../kart.lazy'
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
const mockSetAllFilters = vi.fn()
const mockClearFilters = vi.fn()

const filterState = {
    searchQuery: '',
    organizationForms: [],
    naeringskode: '',
    revenueMin: null,
    revenueMax: null,
    profitMin: null,
    profitMax: null,
    equityMin: null,
    equityMax: null,
    operatingProfitMin: null,
    operatingProfitMax: null,
    liquidityRatioMin: null,
    liquidityRatioMax: null,
    equityRatioMin: null,
    equityRatioMax: null,
    employeeMin: null,
    employeeMax: null,
    municipality: '',
    municipalityCode: '',
    county: '',
    countyCode: '',
    foundedFrom: null,
    foundedTo: null,
    bankruptFrom: null,
    bankruptTo: null,
    isBankrupt: null,
    inLiquidation: null,
    inForcedLiquidation: null,
    hasAccounting: null,
    sortBy: 'navn',
    sortOrder: 'asc',
    setAllFilters: mockSetAllFilters,
    clearFilters: mockClearFilters,
}

vi.mock('../../store/filterStore', () => {
    const mockStore = vi.fn()
    ; (mockStore as any).getState = () => filterState
    return { useFilterStore: mockStore }
})
vi.mock('lucide-react', () => ({ Map: () => <div /> }))

// Mock router
const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
    createFileRoute: () => (config: any) => config,
    createLazyFileRoute: () => (config: any) => config,
    useNavigate: () => mockNavigate,
    useSearch: () => ({}),
    useLocation: () => ({ pathname: '/kart' }),
     
    Link: ({ children }: any) => <a>{children}</a>
}))

describe('KartPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useFilterStore).mockReturnValue(filterState as never)
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

        expect(mockSetAllFilters).toHaveBeenCalledWith({
            county: 'Oslo',
            countyCode: '03',
            municipality: '',
            municipalityCode: '',
        })
        expect(mockNavigate).toHaveBeenCalled()

        const navigateArg = mockNavigate.mock.calls[mockNavigate.mock.calls.length - 1]?.[0]
        expect(navigateArg.search({ municipality_code: '0301', municipality: 'OSLO' })).toEqual({
            municipality_code: undefined,
            municipality: undefined,
            county_code: '03',
            county: 'Oslo',
        })
    })
})
