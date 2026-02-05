/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MunicipalityDashboardPage } from '../kommune.$code'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'

// Mock components
vi.mock('../../components/layout', () => ({
    SEOHead: () => <div data-testid="seo-head" />,
    Breadcrumbs: () => <div data-testid="breadcrumbs" />
}))

vi.mock('../../components/maps/HeroMap', () => ({
    HeroMap: () => <div data-testid="hero-map" />
}))

vi.mock('../../components/dashboard', () => ({
    TrendChart: () => <div data-testid="trend-chart-generic" />,
    EstablishmentTrendChart: () => <div data-testid="trend-chart" />,
    TopCompanyList: () => <div data-testid="top-companies" />,
    NewestCompaniesList: () => <div data-testid="newest-companies" />,
    BankruptciesSection: () => <div data-testid="bankruptcies" />,
    SectorDistribution: () => <div data-testid="sectors" />
}))

// Mock router
vi.mock('@tanstack/react-router', () => ({
    createFileRoute: () => (config: any) => ({
        useParams: () => ({ code: '0301-oslo' }),
        ...config
    }),
    Link: ({ children }: any) => <a>{children}</a>
}))

describe('MunicipalityDashboardPage', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
    })

    const renderPage = () => render(
        <QueryClientProvider client={queryClient}>
            <MunicipalityDashboardPage />
        </QueryClientProvider>
    )

    it('renders municipality data from MSW', async () => {
        renderPage()

        expect(screen.getByText(/Laster lokal innsikt/)).toBeInTheDocument()

        await waitFor(() => {
            expect(screen.getByText('MOCK KOMMUNE')).toBeInTheDocument()
            expect(screen.getByText('700 000')).toBeInTheDocument()
            expect(screen.getByText('50 000')).toBeInTheDocument()
            expect(screen.getByTestId('hero-map')).toBeInTheDocument()
        })
    })

    it('handles error state', async () => {
        // Use a very specific handler to override the default one
        server.use(
            http.get('*/api/v1/municipality/0301', () => {
                return new HttpResponse(null, { status: 404 })
            })
        )

        renderPage()

        await waitFor(() => {
            expect(screen.getByText(/Kunne ikke finne data/i)).toBeInTheDocument()
        }, { timeout: 4000 })
    })
})
