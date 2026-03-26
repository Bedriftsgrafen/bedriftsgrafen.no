import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CompanyDetailContent } from '../CompanyDetailContent'
import type { CompanyWithAccounting } from '../../../types'

// Mock child components to keep tests focused
vi.mock('../CompanyModalHeader', () => ({
    CompanyModalHeader: ({ company }: { company?: { navn?: string } }) => (
        <div data-testid="company-header">{company?.navn}</div>
    )
}))
vi.mock('../ModalTabs', () => ({
    ModalTabs: ({ onTabChange }: { onTabChange: (tab: string) => void }) => (
        <div data-testid="modal-tabs">
            <button onClick={() => onTabChange('okonomi')}>Økonomi</button>
        </div>
    )
}))
vi.mock('../OverviewTab', () => ({
    OverviewTab: () => <div data-testid="overview-tab">Overview</div>
}))
vi.mock('../SimilarCompanies', () => ({
    SimilarCompanies: () => <div data-testid="similar-companies" />
}))
vi.mock('../FinancialsTab', () => ({
    FinancialsTab: () => <div data-testid="financials-tab">Financials</div>
}))
vi.mock('../IndustryBenchmark', () => ({
    IndustryBenchmark: () => <div data-testid="benchmark-tab">Benchmark</div>
}))
vi.mock('../SubUnitsTab', () => ({
    SubUnitsTab: () => <div data-testid="subunits-tab">SubUnits</div>
}))
vi.mock('../RolesTab', () => ({
    RolesTab: () => <div data-testid="roles-tab">Roles</div>
}))
vi.mock('../../skeletons/ChartSkeleton', () => ({
    ChartSkeleton: () => <div data-testid="chart-skeleton" />
}))
vi.mock('../../ErrorMessage', () => ({
    ErrorMessage: ({ message }: { message: string }) => <div data-testid="error-message">{message}</div>
}))

// JSDOM doesn't implement scrollTo on elements
beforeAll(() => {
    Element.prototype.scrollTo = vi.fn()
})

const mockCompany: CompanyWithAccounting = {
    orgnr: '123456789',
    navn: 'Test Selskap AS',
    organisasjonsform: 'AS',
    naeringskode: '62.010',
    postadresse: { adresse: ['Testgate 1'], postnummer: '0301', poststed: 'Oslo', kommune: 'Oslo', kommunenummer: '0301', land: 'Norge' },
    forretningsadresse: { adresse: ['Testgate 1'], postnummer: '0301', poststed: 'Oslo', kommune: 'Oslo', kommunenummer: '0301', land: 'Norge' },
    regnskap: [{ id: 1, aar: 2023, total_inntekt: null, aarsresultat: null, egenkapital: null, gjeldsgrad: null, driftsresultat: null, salgsinntekter: null, omloepsmidler: null, kortsiktig_gjeld: null, avskrivninger: null }],
    antall_ansatte: 10,
    konkurs: false,
    under_avvikling: false,
    under_tvangsavvikling: false,
    stiftelsesdato: '2020-01-01',
    registreringsdato_enhetsregisteret: '2020-01-01'
}

const defaultProps = {
    company: mockCompany,
    companyLoading: false,
    companyError: false,
    selectedYear: 2023,
    onSelectYear: vi.fn(),
    kpiData: undefined,
    kpiLoading: false,
    kpiError: false,
    copiedOrgnr: false,
    onCopyOrgnr: vi.fn(),
    onShare: vi.fn(),
    onRetryCompany: vi.fn(),
    onRetryKpi: vi.fn(),
    onImport: vi.fn(),
    isImporting: false,
    activeTab: 'oversikt' as const,
    onTabChange: vi.fn(),
}

describe('CompanyDetailContent', () => {
    it('renders company header and overview tab when loaded', () => {
        render(<CompanyDetailContent {...defaultProps} />)

        expect(screen.getByTestId('company-header')).toHaveTextContent('Test Selskap AS')
        expect(screen.getByTestId('overview-tab')).toBeInTheDocument()
    })

    it('renders loading skeleton when companyLoading is true', () => {
        render(<CompanyDetailContent {...defaultProps} companyLoading={true} company={undefined} />)

        expect(screen.getByTestId('chart-skeleton')).toBeInTheDocument()
        expect(screen.queryByTestId('overview-tab')).not.toBeInTheDocument()
    })

    it('renders error message when companyError is true', () => {
        render(<CompanyDetailContent {...defaultProps} companyError={true} company={undefined} />)

        expect(screen.getByTestId('error-message')).toHaveTextContent('Kunne ikke laste virksomhetsdata')
    })

    it('renders correct tab content for each activeTab', () => {
        const { rerender } = render(<CompanyDetailContent {...defaultProps} activeTab="okonomi" />)
        expect(screen.getByTestId('financials-tab')).toBeInTheDocument()

        rerender(<CompanyDetailContent {...defaultProps} activeTab="sammenligning" />)
        expect(screen.getByTestId('benchmark-tab')).toBeInTheDocument()

        rerender(<CompanyDetailContent {...defaultProps} activeTab="avdelinger" />)
        expect(screen.getByTestId('subunits-tab')).toBeInTheDocument()

        rerender(<CompanyDetailContent {...defaultProps} activeTab="roller" />)
        expect(screen.getByTestId('roles-tab')).toBeInTheDocument()
    })

    it('applies constrained height classes when constrainHeight is true', () => {
        const { container } = render(<CompanyDetailContent {...defaultProps} constrainHeight={true} />)

        const outerDiv = container.firstChild as HTMLElement
        expect(outerDiv.className).toContain('max-h-[90vh]')
        expect(outerDiv.className).toContain('h-[90vh]')
    })

    it('does not apply constrained height classes when constrainHeight is false', () => {
        const { container } = render(<CompanyDetailContent {...defaultProps} constrainHeight={false} />)

        const outerDiv = container.firstChild as HTMLElement
        expect(outerDiv.className).not.toContain('max-h-[90vh]')
        expect(outerDiv.className).not.toContain('h-[90vh]')
        expect(outerDiv.className).toContain('min-h-[400px]')
    })

    it('calls onTabChange when tab is clicked', () => {
        const onTabChange = vi.fn()
        render(<CompanyDetailContent {...defaultProps} onTabChange={onTabChange} />)

        screen.getByText('Økonomi').click()
        expect(onTabChange).toHaveBeenCalledWith('okonomi')
    })
})
