/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IndustryDashboardPage } from '../bransje.$code.lazy'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'

vi.mock('../../components/layout', () => ({
    SEOHead: () => <div data-testid="seo-head" />,
    Breadcrumbs: () => <div data-testid="breadcrumbs" />
}))

vi.mock('../../components/ErrorMessage', () => ({
    ErrorMessage: ({ message }: { message: string }) => <div data-testid="error-message">{message}</div>
}))

vi.mock('../../components/dashboard', () => ({
    TrendChart: () => <div data-testid="trend-chart" />,
    EstablishmentTrendChart: () => <div data-testid="establishment-trend" />,
    TopCompanyList: () => <div data-testid="top-companies" />,
    NewestCompaniesList: () => <div data-testid="newest-companies" />,
    BankruptciesSection: () => <div data-testid="bankruptcies" />,
}))

vi.mock('@tanstack/react-router', () => ({
    createFileRoute: () => (config: any) => ({
        useParams: () => ({ code: '62-informasjonsteknologi' }),
        ...config
    }),
    createLazyFileRoute: () => (config: any) => ({
        useParams: () => ({ code: '62-informasjonsteknologi' }),
        ...config
    }),
    Link: ({ children, ...props }: any) => <a href={props.to}>{children}</a>
}))

const MOCK_INDUSTRY_DASHBOARD = {
    nace_division: '62',
    nace_name: 'Tjenester tilknyttet informasjonsteknologi',
    nace_section: 'J',
    nace_section_name: 'Informasjon og kommunikasjon',
    company_count: 30000,
    total_employees: 60000,
    avg_employees: 2.0,
    total_revenue: 200000000000,
    avg_revenue: 6666666,
    median_revenue: null,
    total_profit: null,
    avg_profit: null,
    profitable_count: 20000,
    avg_operating_margin: 12.5,
    new_last_year: 1500,
    bankruptcies_last_year: 50,
    bankrupt_count: 100,
    establishment_trend: [],
    bankrupt_trend: [],
    subclasses: [
        { nace_code: '62.010', nace_name: 'Programmeringstjenester', company_count: 20000, total_employees: 40000 },
        { nace_code: '62.020', nace_name: 'Konsulentvirksomhet', company_count: 8000, total_employees: 15000 },
    ],
    top_counties: [
        { nace_division: '03', nace_name: 'Oslo', company_count: 10000, percentage_of_total: 33.3 },
    ],
    top_companies: [],
    newest_companies: [],
    latest_bankruptcies: [],
    ranking_by_revenue: { rank: 13, out_of: 85 },
    ranking_by_companies: { rank: 5, out_of: 85 },
    ranking_by_employees: { rank: 8, out_of: 85 },
}

describe('IndustryDashboardPage', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false, retryDelay: 0 } },
        })

        server.use(
            http.get('*/v1/stats/industries/62/dashboard', () => {
                return HttpResponse.json(MOCK_INDUSTRY_DASHBOARD)
            })
        )
    })

    const renderPage = () => render(
        <QueryClientProvider client={queryClient}>
            <IndustryDashboardPage />
        </QueryClientProvider>
    )

    it('shows loading state initially', () => {
        renderPage()
        expect(screen.getByText(/Laster bransjeinnsikt/)).toBeInTheDocument()
    })

    it('renders industry data after loading', async () => {
        renderPage()

        await waitFor(() => {
            expect(screen.getByText('Tjenester tilknyttet informasjonsteknologi')).toBeInTheDocument()
        })

        expect(screen.getByText('30 000')).toBeInTheDocument()
        expect(screen.getByText('60 000')).toBeInTheDocument()
        expect(screen.getByText('Seksjon J')).toBeInTheDocument()
        expect(screen.getByTestId('seo-head')).toBeInTheDocument()
        expect(screen.getByTestId('breadcrumbs')).toBeInTheDocument()
    })

    it('renders metric cards with correct values', async () => {
        renderPage()

        await waitFor(() => {
            expect(screen.getByText('1 500')).toBeInTheDocument() // new last year
            expect(screen.getByText('50')).toBeInTheDocument() // bankruptcies
            expect(screen.getByText('67%')).toBeInTheDocument() // profitable %
        })
    })

    it('renders subclass breakdown', async () => {
        renderPage()

        await waitFor(() => {
            expect(screen.getByText('Programmeringstjenester')).toBeInTheDocument()
            expect(screen.getByText('62.010')).toBeInTheDocument()
            expect(screen.getByText('Konsulentvirksomhet')).toBeInTheDocument()
        })
    })

    it('renders ranking cards', async () => {
        renderPage()

        await waitFor(() => {
            expect(screen.getByText('13')).toBeInTheDocument() // revenue rank
            expect(screen.getByText('5')).toBeInTheDocument() // companies rank
            expect(screen.getByText('8')).toBeInTheDocument() // employees rank
        })
    })

    it('renders dashboard sub-components', async () => {
        renderPage()

        await waitFor(() => {
            expect(screen.getByTestId('establishment-trend')).toBeInTheDocument()
            expect(screen.getByTestId('trend-chart')).toBeInTheDocument()
            expect(screen.getByTestId('top-companies')).toBeInTheDocument()
            expect(screen.getByTestId('newest-companies')).toBeInTheDocument()
            expect(screen.getByTestId('bankruptcies')).toBeInTheDocument()
        })
    })

    it('handles API error', async () => {
        server.use(
            http.get('*/v1/stats/industries/62/dashboard', () => {
                return new HttpResponse(null, { status: 404 })
            })
        )

        renderPage()

        await waitFor(() => {
            expect(screen.getByTestId('error-message')).toBeInTheDocument()
        }, { timeout: 10000 })
    })
})
