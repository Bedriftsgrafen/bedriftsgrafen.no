import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NaceHierarchyBrowser } from '../NaceHierarchyBrowser'

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, to, params, search, className, ...props }: {
        children: ReactNode
        to: string
        params?: Record<string, string>
        search?: Record<string, string>
        className?: string
    }) => {
        const path = params?.code ? to.replace('$code', params.code) : to
        const query = search ? `?${new URLSearchParams(search).toString()}` : ''
        return <a href={`${path}${query}`} className={className} {...props}>{children}</a>
    },
}))

const hierarchy = [
    { code: '58', parent: 'J', level: 2, name: 'Forlagsvirksomhet' },
    { code: '58.1', parent: '58', level: 3, name: 'Utgivelse' },
    { code: '58.11', parent: '58.1', level: 4, name: 'Utgivelse av bøker' },
    { code: '99', parent: 'V', level: 2, name: 'Aktiviteter i internasjonale organisasjoner og organer' },
]

function renderBrowser() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })

    return render(
        <QueryClientProvider client={queryClient}>
            <NaceHierarchyBrowser
                divisionStats={[
                    { nace_division: '58', company_count: 120, total_employees: 30 },
                    { nace_division: '99', company_count: 4, total_employees: null },
                ]}
            />
        </QueryClientProvider>,
    )
}

describe('NaceHierarchyBrowser', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => hierarchy,
        }))
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('renders SSB sections including V from the hierarchy parents', async () => {
        renderBrowser()

        expect(await screen.findByText('Internasjonale organisasjoner')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Internasjonale organisasjoner/i }))

        expect(screen.getByText('99')).toBeInTheDocument()
        expect(screen.getByText('Aktiviteter i internasjonale organisasjoner og organer')).toBeInTheDocument()
        expect(screen.getAllByText('4 virksomheter').length).toBeGreaterThan(0)
    })

    it('links precise search results to the company search tab instead of a modal', async () => {
        renderBrowser()

        const input = await screen.findByRole('searchbox', { name: 'Filtrer næringskodeverket' })
        fireEvent.change(input, { target: { value: '58.11' } })

        await waitFor(() => expect(screen.getByText('Utgivelse av bøker')).toBeInTheDocument())

        const companyLinks = screen.getAllByRole('link', { name: /Vis virksomheter med NACE 58.11/ })
        expect(companyLinks[0]).toHaveAttribute('href', '/bransjer?tab=search&nace=58.11')
    })
})