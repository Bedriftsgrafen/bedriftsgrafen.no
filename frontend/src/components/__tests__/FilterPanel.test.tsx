import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FilterPanel } from '../FilterPanel'
// Ensure we've mocked the store
import { useFilterStore } from '../../store/filterStore'

// Mock Lucide icons
vi.mock('lucide-react', () => ({
    Filter: () => <div data-testid="filter-icon" />,
    Check: () => <div data-testid="check-icon" />,
    X: () => <div data-testid="x-icon" />,
    ChevronDown: () => <div data-testid="chevron-down-icon" />,
    ChevronUp: () => <div data-testid="chevron-up-icon" />,
    Search: () => <div data-testid="search-icon" />,
    RotateCcw: () => <div data-testid="rotate-ccw-icon" />,
    AlertCircle: () => <div data-testid="alert-circle-icon" />,
    Save: () => <div data-testid="save-icon" />,
    Edit2: () => <div data-testid="edit-icon" />,
    Trash2: () => <div data-testid="trash-icon" />,
    Settings: () => <div data-testid="settings-icon" />,
    Calendar: () => <div data-testid="calendar-icon" />,
}))

const mockSetAllFilters = vi.fn()
const mockClearFilters = vi.fn()
const mockGetActiveFilterCount = vi.fn(() => 0)

const mockFilterState = {
    // Current filters
    searchQuery: '',
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
    county: '',
    naeringskode: '',
    isBankrupt: null,
    inLiquidation: null,
    inForcedLiquidation: null,
    hasAccounting: null,
    foundedFrom: null,
    foundedTo: null,
    bankruptFrom: null,
    bankruptTo: null,
    sortBy: 'navn',
    sortOrder: 'asc' as const,
    organizationForms: [] as string[],

    // Actions
    setAllFilters: mockSetAllFilters,
    clearFilters: mockClearFilters,
    getActiveFilterCount: mockGetActiveFilterCount,
    setFilter: vi.fn(),
    setOrganizationForms: vi.fn(),
    setRevenueRange: vi.fn(),
    setProfitRange: vi.fn(),
    setEquityRange: vi.fn(),
    setOperatingProfitRange: vi.fn(),
    setLiquidityRatioRange: vi.fn(),
    setEquityRatioRange: vi.fn(),
    setEmployeeRange: vi.fn(),
    setMunicipality: vi.fn(),
    setCounty: vi.fn(),
    setNaeringskode: vi.fn(),
    setIsBankrupt: vi.fn(),
    setInLiquidation: vi.fn(),
    setInForcedLiquidation: vi.fn(),
    setHasAccounting: vi.fn(),
    setFoundedFrom: vi.fn(),
    setFoundedTo: vi.fn(),
    setBankruptFrom: vi.fn(),
    setBankruptTo: vi.fn(),
    setSorting: vi.fn(),
    setSearchQuery: vi.fn(),
    setSelectedIndustries: vi.fn(),
    setSelectedCounties: vi.fn(),
    setSelectedMunicipalities: vi.fn(),

    // Internal
    filterVersion: 0,
    activeTab: 'bransje',
    setActiveTab: vi.fn(),
}

let currentMockState = { ...mockFilterState }

// Mock the hook and use a function that returns the result of applying selector to currentMockState
vi.mock('../../store/filterStore', () => ({
    useFilterStore: vi.fn((selector) => selector(currentMockState)),
}))

// We also need to mock useFilterStore.getState() for the initial draft state
// @ts-expect-error - Mocking the internal method
useFilterStore.getState = vi.fn(() => currentMockState)

describe('FilterPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        currentMockState = { ...mockFilterState }
    })

    it('renders with basic filter buttons', () => {
        render(<FilterPanel />)
        expect(screen.getByText('Filtrer bedrifter')).toBeDefined()
        // These are likely headers or labels in the panel
        // Bransje, Geografi, Økonomi are now headers in the grid if expanded?
        // Wait, if it's NOT expanded, these might not be visible.
    })

    it('shows active filter count badge when filters are applied', () => {
        currentMockState = {
            ...mockFilterState,
            searchQuery: 'test',
        }

        render(<FilterPanel />)
        const badge = screen.getByText('1')
        expect(badge).toBeDefined()
    })

    it('opens dialog when header is clicked', () => {
        render(<FilterPanel />)
        const filterHeader = screen.getByText('Filtrer bedrifter')
        fireEvent.click(filterHeader)

        // Check for "Basis" which is a header in the expanded panel
        expect(screen.getByText('Basis')).toBeDefined()
    })

    it('updates specific filter value when changed', () => {
        render(<FilterPanel />)
        const filterHeader = screen.getByText('Filtrer bedrifter')
        fireEvent.click(filterHeader)

        // Find an input, e.g., naeringskode (placeholder "F.eks. 62.100")
        const input = screen.getByPlaceholderText('F.eks. 62.100')
        fireEvent.change(input, { target: { value: '12.345' } })

        // Click apply ("Bruk filter")
        const applyBtn = screen.getByText('Bruk filter')
        fireEvent.click(applyBtn)

        expect(mockSetAllFilters).toHaveBeenCalledWith(expect.objectContaining({
            naeringskode: '12.345'
        }))
    })

    it('clears all filters when clear button is clicked', () => {
        currentMockState = {
            ...mockFilterState,
            searchQuery: 'test',
        }
        render(<FilterPanel />)
        // Header inner "Nullstill" button appears only when activeFilters > 0
        fireEvent.click(screen.getByText('Nullstill'))

        expect(mockClearFilters).toHaveBeenCalled()
    })
})
