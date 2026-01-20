import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PersonProfilePage } from '../person.$name.$birthdate.lazy'
import { usePersonRolesQuery } from '../../hooks/queries/usePersonRolesQuery'
import { QueryClient, QueryClientProvider, UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { PersonRole } from '../../hooks/queries/usePersonRolesQuery'

// Mock the query hook
vi.mock('../../hooks/queries/usePersonRolesQuery', () => ({
    usePersonRolesQuery: vi.fn()
}))

// Mock breadcrumbs and SEO
vi.mock('../../components/layout', () => ({
    SEOHead: () => <div data-testid="seo-head" />,
    Breadcrumbs: () => <div data-testid="breadcrumbs" />
}))

// Mock the router hooks directly to prevent them from looking for a RouterProvider
vi.mock('@tanstack/react-router', async () => {
    const actual = await vi.importActual('@tanstack/react-router')
    return {
        ...actual,
        // We need to mock the Route object's useParams because the component calls Route.useParams()
        // But the Route object is created by createLazyFileRoute
        createLazyFileRoute: () => () => ({
            useParams: vi.fn().mockReturnValue({ name: 'Ola%20Nordmann', birthdate: '1980-05-15' }),
        }),
        Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
    }
})

describe('PersonProfilePage', () => {
    const mockUsePersonRolesQuery = vi.mocked(usePersonRolesQuery)
    const mockWindowOpen = vi.fn()

    beforeEach(() => {
        vi.clearAllMocks()
        mockUsePersonRolesQuery.mockReturnValue({
            data: [],
            isLoading: false,
            isError: false,
        } as unknown as UseQueryResult<PersonRole[]>)

        // Mock window.open
        window.open = mockWindowOpen
    })

    const createWrapper = () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        })
        return ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        )
    }

    it('renders the "Søk på 1881" button', () => {
        const wrapper = createWrapper()
        render(<PersonProfilePage />, { wrapper })
        expect(screen.getByText('Søk på 1881')).toBeInTheDocument()
    })

    it('opens 1881 search link when clicked with correct encoded query', () => {
        const wrapper = createWrapper()
        render(<PersonProfilePage />, { wrapper })
        const button = screen.getByText('Søk på 1881')
        fireEvent.click(button)

        expect(mockWindowOpen).toHaveBeenCalledWith(
            'https://www.1881.no/?query=Ola%20Nordmann&type=person',
            '_blank',
            'noopener,noreferrer'
        )
    })
})
