/**
 * Tests for shared dashboard components
 * 
 * These components are used by both county and municipality dashboards.
 */

import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { 
  TrendChart,
  EstablishmentTrendChart, 
  TopCompanyList, 
  NewestCompaniesList,
  BankruptciesSection,
  SectorDistribution 
} from '../dashboard'
import type { TrendPoint, SectorStat, Company } from '../../types'
import type { ReactNode } from 'react'

// Mock Recharts to avoid canvas issues in tests
vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
        <div data-testid="responsive-container">{children}</div>
    ),
    AreaChart: ({ data }: { data: unknown }) => (
        <div data-testid="area-chart" data-points={JSON.stringify(data)} />
    ),
    Area: () => <div data-testid="area" />,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
}))

// Mock TanStack Router - components use Link from @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, to }: { children: ReactNode; to: string }) => (
        <a href={to} data-testid="router-link">{children}</a>
    ),
}))

// Test data
const mockTrendData: TrendPoint[] = [
    { label: 'Jan', value: 150 },
    { label: 'Feb', value: 180 },
    { label: 'Mar', value: 120 },
]

const mockSectors: SectorStat[] = [
    { nace_division: '47', nace_name: 'Detaljhandel', company_count: 500, percentage_of_total: 25.5 },
    { nace_division: '62', nace_name: 'IT-tjenester', company_count: 300, percentage_of_total: 15.3 },
]

const mockCompanies: Company[] = [
    { 
        orgnr: '123456789', 
        navn: 'Test AS', 
        organisasjonsform: 'AS',
        latest_revenue: 5000000,
    },
    { 
        orgnr: '987654321', 
        navn: 'Demo AS', 
        organisasjonsform: 'AS',
        latest_revenue: 3000000,
    },
]

const mockNewCompanies: Company[] = [
    { 
        orgnr: '111111111', 
        navn: 'Nytt AS', 
        organisasjonsform: 'AS',
        stiftelsesdato: '2025-01-15',
    },
]

const mockBankruptcies: Company[] = [
    { 
        orgnr: '222222222', 
        navn: 'Konkurs AS', 
        organisasjonsform: 'AS',
        konkursdato: '2025-01-10',
    },
]

// ============================================================================
// TrendChart Tests
// ============================================================================
describe('TrendChart', () => {
    it('renders with title and subtitle', () => {
        render(<TrendChart data={mockTrendData} title="Test Trend" subtitle="Sub Title" />)
        
        expect(screen.getByText('Test Trend')).toBeInTheDocument()
        expect(screen.getByText('Sub Title')).toBeInTheDocument()
    })

    it('passes data to chart component', () => {
        render(<TrendChart data={mockTrendData} title="Test" />)
        
        const chart = screen.getByTestId('area-chart')
        expect(chart).toHaveAttribute('data-points', JSON.stringify(mockTrendData))
    })
})

// ============================================================================
// EstablishmentTrendChart Tests
// ============================================================================
describe('EstablishmentTrendChart', () => {
    it('renders with default title and subtitle', () => {
        render(<EstablishmentTrendChart data={mockTrendData} />)
        
        expect(screen.getByText('Nyetableringer')).toBeInTheDocument()
        expect(screen.getByText('SISTE 12 MÅNEDER')).toBeInTheDocument()
    })

    it('renders with custom title and subtitle', () => {
        render(
            <TrendChart 
                data={mockTrendData} 
                title="Custom Title"
                subtitle="Custom Subtitle"
            />
        )
        
        expect(screen.getByText('Custom Title')).toBeInTheDocument()
        expect(screen.getByText('Custom Subtitle')).toBeInTheDocument()
    })

    it('passes data to chart component', () => {
        render(<EstablishmentTrendChart data={mockTrendData} />)
        
        const chart = screen.getByTestId('area-chart')
        expect(chart).toHaveAttribute('data-points', JSON.stringify(mockTrendData))
    })
})

// ============================================================================
// SectorDistribution Tests
// ============================================================================
describe('SectorDistribution', () => {
    it('renders with default title', () => {
        render(<SectorDistribution sectors={mockSectors} />)
        
        expect(screen.getByText('Største Bransjer')).toBeInTheDocument()
    })

    it('renders all sectors', () => {
        render(<SectorDistribution sectors={mockSectors} />)
        
        expect(screen.getByText('Detaljhandel')).toBeInTheDocument()
        expect(screen.getByText('IT-tjenester')).toBeInTheDocument()
    })

    it('displays sector percentages', () => {
        render(<SectorDistribution sectors={mockSectors} />)
        
        expect(screen.getByText('25.5%')).toBeInTheDocument()
        expect(screen.getByText('15.3%')).toBeInTheDocument()
    })

    it('renders with custom title', () => {
        render(<SectorDistribution sectors={mockSectors} title="Industries" />)
        
        expect(screen.getByText('Industries')).toBeInTheDocument()
    })
})

// ============================================================================
// TopCompanyList Tests
// ============================================================================
describe('TopCompanyList', () => {
    it('renders with default title and subtitle', () => {
        render(<TopCompanyList companies={mockCompanies} />)
        
        expect(screen.getByText('Største Virksomheter')).toBeInTheDocument()
        expect(screen.getByText('ETTER OMSETNING')).toBeInTheDocument()
    })

    it('renders company names', () => {
        render(<TopCompanyList companies={mockCompanies} />)
        
        expect(screen.getByText('Test AS')).toBeInTheDocument()
        expect(screen.getByText('Demo AS')).toBeInTheDocument()
    })

    it('displays rank numbers', () => {
        render(<TopCompanyList companies={mockCompanies} />)
        
        expect(screen.getByText('01')).toBeInTheDocument()
        expect(screen.getByText('02')).toBeInTheDocument()
    })

    it('renders company links', () => {
        render(<TopCompanyList companies={mockCompanies} />)
        
        const links = screen.getAllByRole('link')
        expect(links).toHaveLength(2)
    })
})

// ============================================================================
// NewestCompaniesList Tests
// ============================================================================
describe('NewestCompaniesList', () => {
    it('renders with default title and subtitle', () => {
        render(
            <NewestCompaniesList 
                companies={mockNewCompanies}
                regionName="Vestland"
                regionCode="46"
                regionType="county"
            />
        )
        
        expect(screen.getByText('Siste Nyetableringer')).toBeInTheDocument()
        expect(screen.getByText('ETTER DATO')).toBeInTheDocument()
    })

    it('renders company names', () => {
        render(
            <NewestCompaniesList 
                companies={mockNewCompanies}
                regionName="Vestland"
                regionCode="46"
                regionType="county"
            />
        )
        
        expect(screen.getByText('Nytt AS')).toBeInTheDocument()
    })

    it('shows "see all" link with region name', () => {
        render(
            <NewestCompaniesList 
                companies={mockNewCompanies}
                regionName="Vestland"
                regionCode="46"
                regionType="county"
            />
        )
        
        expect(screen.getByText(/Se alle nyetableringer i Vestland/)).toBeInTheDocument()
    })
})

// ============================================================================
// BankruptciesSection Tests
// ============================================================================
describe('BankruptciesSection', () => {
    it('renders title', () => {
        render(
            <BankruptciesSection 
                companies={mockBankruptcies}
                regionName="Vestland"
                regionCode="46"
                regionType="county"
            />
        )
        
        expect(screen.getByText('Siste Konkurser')).toBeInTheDocument()
    })

    it('renders bankruptcy company names', () => {
        render(
            <BankruptciesSection 
                companies={mockBankruptcies}
                regionName="Vestland"
                regionCode="46"
                regionType="county"
            />
        )
        
        expect(screen.getByText('Konkurs AS')).toBeInTheDocument()
    })

    it('shows empty state when no bankruptcies', () => {
        render(
            <BankruptciesSection 
                companies={[]}
                regionName="Vestland"
                regionCode="46"
                regionType="county"
            />
        )
        
        expect(screen.getByText('Ingen nylige konkurser registrert')).toBeInTheDocument()
    })

    it('shows "see all" link with region name', () => {
        render(
            <BankruptciesSection 
                companies={mockBankruptcies}
                regionName="Vestland"
                regionCode="46"
                regionType="county"
            />
        )
        
        expect(screen.getByText(/Se alle konkurser i Vestland/)).toBeInTheDocument()
    })
})
