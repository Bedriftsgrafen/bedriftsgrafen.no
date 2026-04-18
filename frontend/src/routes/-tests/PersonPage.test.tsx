/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PersonProfilePage } from '../person.$name.$birthdate.lazy'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { server } from '../../mocks/server'
import { http, HttpResponse } from 'msw'

// Mock components
vi.mock('../../components/layout', () => ({
    SEOHead: () => <div data-testid="seo-head" />,
    Breadcrumbs: () => <div data-testid="breadcrumbs" />
}))

vi.mock('../../components/common/Button', () => ({
    Button: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>
}))

// Mock router
const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
    createLazyFileRoute: () => (config: any) => ({
        useNavigate: () => mockNavigate,
        useParams: () => ({ name: 'Test Person', birthdate: '1980-01-01' }),
        useSearch: () => ({}),
        ...config
    }),
    Link: ({ children }: any) => <a>{children}</a>
}))

vi.mock('../../hooks/useSlowLoadingToast', () => ({
    useSlowLoadingToast: vi.fn()
}))

vi.mock('../../img/1881-logo.png', () => ({
    default: 'mock-logo'
}))

describe('PersonProfilePage', () => {
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
            <PersonProfilePage />
        </QueryClientProvider>
    )

    it('renders person data and roles from MSW', async () => {
        renderPage()

        expect(screen.getByText('Test Person')).toBeInTheDocument()

        // Default tab is Oversikt — verify overview renders
        await waitFor(() => {
            expect(screen.getByText('Oversikt')).toBeInTheDocument()
            expect(screen.getByText('Roller')).toBeInTheDocument()
        })

        // Switch to Roller tab to verify role details
        fireEvent.click(screen.getByText('Roller'))

        await waitFor(() => {
            expect(screen.getByText('MOCK COMPANY AS')).toBeInTheDocument()
            expect(screen.getByText('Daglig leder')).toBeInTheDocument()
            expect(screen.getByText('HISTORICAL CORP')).toBeInTheDocument()
            expect(screen.getAllByText('Fratrådt').length).toBeGreaterThanOrEqual(1)
        })
    })

    it('handles empty roles state', async () => {
        server.use(
            http.get('/api/v1/people/roles', () => {
                return HttpResponse.json([])
            })
        )

        renderPage()

        await waitFor(() => {
            expect(screen.getByText(/Denne personen har ingen registrerte roller i næringsvirksomhet/)).toBeInTheDocument()
        })
    })

    it('handles error state', async () => {
        server.use(
            http.get('/api/v1/people/roles', () => {
                return new HttpResponse(null, { status: 500 })
            })
        )

        renderPage()

        await waitFor(() => {
            expect(screen.getByText(/Kunne ikke hente roller for denne personen/)).toBeInTheDocument()
        })
    })
})
