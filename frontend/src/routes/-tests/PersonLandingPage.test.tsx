/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'

// Capture navigation calls
const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
    createLazyFileRoute: () => () => ({ component: null }),
    useNavigate: () => mockNavigate,
    Link: ({ children, ...props }: any) => <a data-testid="person-link" {...props}>{children}</a>,
}))

// Mock recharts (avoids jsdom SVG measurement issues)
vi.mock('recharts', () => ({
    PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
    Pie: () => null,
    Cell: () => null,
    BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    Tooltip: () => null,
    Legend: () => null,
}))

vi.mock('../../hooks/useDocumentTitle', () => ({
    useDocumentTitle: vi.fn(),
}))

// Import component after mocks
// We test the sub-components directly since the route component depends on
// createLazyFileRoute which requires router context. Instead we do an
// integration-style test of the key tab components with MSW data.
import { PersonOverviewTab } from '../../components/person/PersonOverviewTab'
import { PersonToplistTab } from '../../components/person/PersonToplistTab'
import { PersonLandingHero } from '../../components/person/PersonLandingHero'
import { usePersonToplistsQuery } from '../../hooks/queries/usePersonToplistsQuery'
import { usePersonStatsQuery } from '../../hooks/queries/usePersonStatsQuery'

// Helper that simulates the landing page composition using real hooks + MSW
function PersonLandingIntegration({ tab = 'oversikt' }: { tab?: string }) {
    const { data: toplists = [], isLoading: toplistsLoading } = usePersonToplistsQuery()
    const { data: stats, isLoading: statsLoading } = usePersonStatsQuery()
    const loading = toplistsLoading || statsLoading

    return (
        <div>
            <PersonLandingHero stats={stats} loading={statsLoading} />
            {loading && !toplists.length ? (
                <div data-testid="loading-spinner" />
            ) : (
                <>
                    {tab === 'oversikt' && (
                        <PersonOverviewTab toplists={toplists} stats={stats} onTabChange={vi.fn()} />
                    )}
                    {tab === 'topplister' && (
                        <PersonToplistTab
                            toplists={toplists}
                            selectedCategory="active_roles"
                            onCategoryChange={vi.fn()}
                        />
                    )}
                </>
            )}
        </div>
    )
}

describe('PersonLandingPage integration', () => {
    let queryClient: QueryClient

    beforeEach(() => {
        vi.clearAllMocks()
        queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })
    })

    const renderPage = (tab = 'oversikt') =>
        render(
            <QueryClientProvider client={queryClient}>
                <PersonLandingIntegration tab={tab} />
            </QueryClientProvider>
        )

    it('renders hero and toplists from MSW data', async () => {
        renderPage()

        // Initially shows spinner
        expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()

        // Wait for MSW data
        await waitFor(() => {
            expect(screen.getByText('Ola Nordmann')).toBeInTheDocument()
        })

        // Hero shows stats
        expect(screen.getByText('Personer')).toBeInTheDocument()

        // Overview tab shows category headings
        expect(screen.getByText('Flest aktive roller')).toBeInTheDocument()
    })

    it('renders topplister tab with ranked table', async () => {
        renderPage('topplister')

        await waitFor(() => {
            expect(screen.getByText('Ola Nordmann')).toBeInTheDocument()
        })

        // Table headers
        expect(screen.getByText('Navn')).toBeInTheDocument()
        expect(screen.getByText('Verdi')).toBeInTheDocument()

        // Category buttons present
        const buttons = screen.getAllByRole('button')
        const buttonLabels = buttons.map(b => b.textContent)
        expect(buttonLabels).toContain('Aktive roller')
        expect(buttonLabels).toContain('Styreleder')
    })

    it('handles API error for toplists gracefully', async () => {
        server.use(
            http.get('*/api/v1/people/toplists', () => {
                return new HttpResponse(null, { status: 500 })
            })
        )

        renderPage()

        // Should not crash — hero still renders
        await waitFor(() => {
            expect(screen.getByText('Personer')).toBeInTheDocument()
        })
    })

    it('handles API error for stats gracefully', async () => {
        server.use(
            http.get('*/api/v1/people/stats', () => {
                return new HttpResponse(null, { status: 500 })
            })
        )

        renderPage()

        await waitFor(() => {
            expect(screen.getByText('Ola Nordmann')).toBeInTheDocument()
        })

        // Stats not loaded, so charts shouldn't render
        expect(screen.queryByText('Generasjonsfordeling')).not.toBeInTheDocument()
    })
})
