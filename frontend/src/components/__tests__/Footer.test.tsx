import { render, screen, fireEvent, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Footer } from '../Footer'
import { useActivityOverviewQuery } from '../../hooks/queries/useActivityOverviewQuery'

vi.mock('../../hooks/queries/useActivityOverviewQuery', () => ({
    useActivityOverviewQuery: vi.fn(),
}))

const mockedUseActivityOverviewQuery = vi.mocked(useActivityOverviewQuery)

describe('Footer', () => {
    beforeEach(() => {
        mockedUseActivityOverviewQuery.mockReturnValue({
            data: {
                generated_at: '2026-05-28T05:22:10.916216Z',
                cache_ttl_seconds: 120,
                new_companies: {} as never,
                bankruptcies: {} as never,
                business_changes: {} as never,
                accounting_updates: {} as never,
                employee_changes: {} as never,
                data_status: [
                    {
                        key: 'company_update_last_sync_date',
                        title: 'Enhetsregisteret',
                        description: 'Siste dato Bedriftsgrafen har synket fra Brregs oppdateringsstrøm.',
                        value: '2026-05-28',
                        updated_at: '2026-05-28T05:21:35.432628Z',
                        source: 'Brreg oppdateringsstrøm',
                    },
                ],
                deferred_feeds: [],
            },
        } as never)
    })

    it('opens the Bedriftsgrafen contact modal instead of a direct mailto link', async () => {
        render(<Footer />)

        expect(screen.queryByText('bedriftsgrafen@gmail.com')).not.toBeInTheDocument()

        const contactButton = screen.getByRole('button', { name: /send e-post om nettsiden/i })
        expect(contactButton).not.toHaveAttribute('href')

        fireEvent.click(contactButton)

        const dialog = await screen.findByRole('dialog', { name: 'Kontakt Bedriftsgrafen.no' })
        expect(within(dialog).getByRole('heading', { name: 'Kontakt Bedriftsgrafen.no' })).toBeInTheDocument()
        expect(within(dialog).getByText('Du kontakter Bedriftsgrafen.no, ikke en virksomhet eller person omtalt på siden.')).toBeInTheDocument()
    })

    it('links the data source box to freshness status', () => {
        render(<Footer />)

        expect(mockedUseActivityOverviewQuery).toHaveBeenCalledWith(1)
        expect(screen.getByText(/Sist oppdatert:/i)).toBeInTheDocument()
        expect(screen.getByText(/28\.05\.2026/i)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Se datastatus og siste oppdateringer/i })).toHaveAttribute(
            'href',
            '/oppdateringer?tab=datastatus'
        )
        expect(screen.getByRole('link', { name: /Les om datakilder og datakvalitet/i })).toHaveAttribute(
            'href',
            '/datakilder'
        )
    })

    it('links to trust and legal pages with a visible source disclaimer', () => {
        render(<Footer />)

        expect(screen.getByText(/kan inneholde feil, forsinkelser eller mangler/i)).toBeInTheDocument()
        const legalNav = screen.getByRole('navigation', { name: 'Tillit og vilkår' })
        expect(legalNav).toBeInTheDocument()
        expect(within(legalNav).getByRole('link', { name: /Datakilder/i })).toHaveAttribute('href', '/datakilder')
        expect(within(legalNav).getByRole('link', { name: /Personvern/i })).toHaveAttribute('href', '/personvern')
        expect(within(legalNav).getByRole('link', { name: /Vilkår/i })).toHaveAttribute('href', '/vilkar')
    })
})