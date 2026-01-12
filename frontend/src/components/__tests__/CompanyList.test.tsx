import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { CompanyList } from '../CompanyList'
import { Company } from '../../types'

// Mock stores
const mockToggleColumn = vi.fn()
const mockResetColumns = vi.fn()
const mockReorderColumns = vi.fn()
const mockClearFilters = vi.fn()

// Mock useUiStore
vi.mock('../../store/uiStore', async () => {
    const actual = await vi.importActual('../../store/uiStore')
    return {
        ...actual,
        useUiStore: vi.fn(() => ({
            visibleColumns: ['navn', 'orgnr'], // Default checked columns for test
            toggleColumn: mockToggleColumn,
            resetColumns: mockResetColumns,
            reorderColumns: mockReorderColumns,
        })),
    }
})

// Mock useFilterStore
vi.mock('../../store/filterStore', () => ({
    useFilterStore: vi.fn(() => ({
        clearFilters: mockClearFilters,
    }))
}))

const mockCompanies: Company[] = [
    {
        orgnr: '111111111',
        navn: 'Test Company AS',
        organisasjonsform: 'AS',
        naeringskoder: [{ kode: '62.010', beskrivelse: 'Programmering' }],
        antall_ansatte: 10,
        latest_revenue: 1000000,
        latest_profit: 50000,
        latest_operating_margin: 5.0,
        stiftelsesdato: '2020-01-01',
        forretningsadresse: {
            adresse: ['Testveien 1'],
            postnummer: '0101',
            poststed: 'Oslo',
            kommune: 'Oslo',
            land: 'Norge'
        },
        postadresse: {
            adresse: ['Postboks 1'],
            postnummer: '0101',
            poststed: 'Oslo',
            kommune: 'Oslo',
            land: 'Norge'
        }
    },
    {
        orgnr: '222222222',
        navn: 'Another Corp',
        organisasjonsform: 'ENK',
        latest_revenue: 500000,
        latest_profit: 10000,
        latest_operating_margin: 2.0
    }
]

describe('CompanyList', () => {
    const defaultProps = {
        companies: mockCompanies,
        isLoading: false,
        isError: false,
        onSelectCompany: vi.fn(),
        onRetry: vi.fn(),
        sortBy: 'navn',
        sortOrder: 'asc' as const,
        onSortChange: vi.fn(),
        itemsPerPage: 20,
        totalCount: 100,
        countLoading: false,
        viewMode: 'list' as const
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders loading state correctly', () => {
        const { container } = render(<CompanyList {...defaultProps} isLoading={true} companies={[]} />)
        // Should render skeleton logic (checking for animate-pulse class which is used in skeleton)
        // or check if table body is not present in its normal form.
        // CompanyList renders table even if loading?
        // Looking at CompanyList.tsx: renders CompanyTableBody which handles isLoading
        // If isLoading, it returns CompanyListSkeleton.

        // Let's check for the presence of skeleton elements or lack of rows
        // CompanyListSkeleton usually renders multiple rows.
        expect(container.getElementsByClassName('animate-pulse').length).toBeGreaterThan(0)
    })

    it('renders error state correctly', () => {
        render(<CompanyList {...defaultProps} isError={true} />)
        expect(screen.getByText('Kunne ikke laste bedrifter')).toBeInTheDocument()
        expect(screen.getByText('Prøv igjen')).toBeInTheDocument()
    })

    it('renders list of companies in list view', () => {
        render(<CompanyList {...defaultProps} />)
        expect(screen.getByText('Test Company AS')).toBeInTheDocument()
        expect(screen.getByText('Another Corp')).toBeInTheDocument()
        expect(screen.getByText('111111111')).toBeInTheDocument()
    })

    it('renders empty state when no companies found', () => {
        render(<CompanyList {...defaultProps} companies={[]} />)
        expect(screen.getByText('Ingen bedrifter funnet')).toBeInTheDocument()
    })

    it('triggers clearFilters when clicking reset in empty state', () => {
        render(<CompanyList {...defaultProps} companies={[]} />)

        // The EmptyState component has a "Nullstill filtre" button or action
        // In CompanyList.tsx: action={{ label: "Nullstill filtre", onClick: clearFilters }}

        // Find button by text
        const resetBtn = screen.getByText('Nullstill filtre')
        fireEvent.click(resetBtn)

        expect(mockClearFilters).toHaveBeenCalled()
    })

    it('calls onSortChange when clicking a sortable header', () => {
        render(<CompanyList {...defaultProps} />)

        // 'navn' header
        const nameHeader = screen.getByText('Navn')
        fireEvent.click(nameHeader)

        expect(defaultProps.onSortChange).toHaveBeenCalledWith('navn')
    })

    it('handles column text visibility', () => {
        // We mocked useUiStore to return ['navn', 'orgnr']
        render(<CompanyList {...defaultProps} />)

        expect(screen.getByText('Navn')).toBeInTheDocument()
        expect(screen.getByText('Org.nr')).toBeInTheDocument()
        // 'Omsetning' is NOT in our mocked visibleColumns
        expect(screen.queryByText('Omsetning')).not.toBeInTheDocument()
    })

    it('renders card view when viewMode is cards', () => {
        render(<CompanyList {...defaultProps} viewMode="cards" />)
        // Should verify cards are rendered
        // CompanyCard usually displays orgnr and navn too, but structure is different.
        // Checking for card-specific container class or just content presence
        expect(screen.getByText('Test Company AS')).toBeInTheDocument()
        // Ensure table is not rendered
        expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })
})
