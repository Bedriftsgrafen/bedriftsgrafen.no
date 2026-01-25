import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { OverviewTab } from '../OverviewTab'
import { FinancialsTab } from '../FinancialsTab'
import type { CompanyWithAccounting } from '../../../types'

// Mock TanStack Router Link component
vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, ...props }: { children: ReactNode;[key: string]: unknown }) => (
        <a href="#" data-testid="mock-link" {...props}>{children}</a>
    ),
}))

// Mock LocationMap to avoid Leaflet issues in tests
vi.mock('../../common/LocationMap', () => ({
    LocationMap: () => <div data-testid="mock-location-map" />
}))

// Mock AffiliateBanner
vi.mock('../../ads/AffiliateBanner', () => ({
    AffiliateBanner: () => <div data-testid="mock-affiliate-banner" />
}))

// Test wrapper
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

const mockSubunit: CompanyWithAccounting = {
    orgnr: '123456780',
    navn: 'Subunit AS',
    parent_orgnr: '987654321',
    parent_navn: 'Parent Company AS',
    organisasjonsform: 'BEDR',
    regnskap: [],
    naeringskode: '62.010',
    forretningsadresse: {
        adresse: ['Testveien 1'],
        postnummer: '0101',
        poststed: 'OSLO',
        land: 'Norge'
    }
}

const mockSubunitWithData: CompanyWithAccounting = {
    ...mockSubunit,
    regnskap: [{
        id: 1,
        aar: 2023,
        total_inntekt: 1000000,
        aarsresultat: 100000,
        egenkapital: 500000,
        gjeldsgrad: 0.5,
        driftsresultat: 120000,
        salgsinntekter: 900000,
        omloepsmidler: 300000,
        kortsiktig_gjeld: 100000,
        avskrivninger: 20000
    }]
}

describe('Subunit Enhancements - OverviewTab', () => {
    it('displays parent company name and organization number', () => {
        render(<OverviewTab company={mockSubunit} />, { wrapper: createTestWrapper() })

        expect(screen.getByText('Hovedenhet')).toBeInTheDocument()
        expect(screen.getByText('Parent Company AS')).toBeInTheDocument()
        expect(screen.getByText(/Org.nr 987654321/)).toBeInTheDocument()
    })

    it('renders a link to the parent company', () => {
        render(<OverviewTab company={mockSubunit} />, { wrapper: createTestWrapper() })
        
        const link = screen.getByTestId('mock-link')
        expect(link).toBeInTheDocument()
    })
})

describe('Subunit Enhancements - FinancialsTab', () => {
    const mockOnSelectYear = vi.fn()
    const mockOnRetryKpi = vi.fn()
    const mockOnImport = vi.fn()

    it('displays consolidated reporting info box when no local accounting exists', () => {
        render(
            <FinancialsTab 
                company={mockSubunit} 
                selectedYear={null}
                onSelectYear={mockOnSelectYear}
                kpiData={undefined}
                kpiLoading={false}
                kpiError={false}
                onRetryKpi={mockOnRetryKpi}
                onImport={mockOnImport}
                isImporting={false}
            />, 
            { wrapper: createTestWrapper() }
        )

        expect(screen.getByText('Underenhet')).toBeInTheDocument()
        expect(screen.getByText(/rapporteres vanligvis konsolidert/)).toBeInTheDocument()
    })

    it('displays context note even when local accounting data exists', () => {
        render(
            <FinancialsTab 
                company={mockSubunitWithData} 
                selectedYear={2023}
                onSelectYear={mockOnSelectYear}
                kpiData={undefined}
                kpiLoading={false}
                kpiError={false}
                onRetryKpi={mockOnRetryKpi}
                onImport={mockOnImport}
                isImporting={false}
            />, 
            { wrapper: createTestWrapper() }
        )

        expect(screen.getByText('Underenhet')).toBeInTheDocument()
        expect(screen.getByText(/Spesifikke lokale tall/)).toBeInTheDocument()
    })

    it('renders a link to the parent company financials', () => {
        render(
            <FinancialsTab 
                company={mockSubunit} 
                selectedYear={null}
                onSelectYear={mockOnSelectYear}
                kpiData={undefined}
                kpiLoading={false}
                kpiError={false}
                onRetryKpi={mockOnRetryKpi}
                onImport={mockOnImport}
                isImporting={false}
            />, 
            { wrapper: createTestWrapper() }
        )
        
        expect(screen.getByText(/Se hovedenhetens regnskap/)).toBeInTheDocument()
    })
})