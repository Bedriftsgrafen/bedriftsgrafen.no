import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { copyToClipboard } from '../../utils/clipboard'
import { toast } from '../../store/toastStore'
import { apiClient } from '../../utils/apiClient'
import { useComparisonStore } from '../../store/comparisonStore'
import { ComparisonPage, getComparisonShareUrl, parseComparisonOrgNumbers } from '../sammenlign.lazy'

let mockSearch: { orgnr?: string } = { orgnr: '993144169,913352483' }
const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createLazyFileRoute: () => (config: any) => ({
        useSearch: () => mockSearch,
        useNavigate: () => mockNavigate,
        ...config,
    }),
    Link: ({ children, className, title, 'aria-label': ariaLabel, to = '#', params, search }: {
        children: ReactNode
        className?: string
        title?: string
        'aria-label'?: string
        to?: string
        params?: Record<string, string>
        search?: Record<string, string | undefined>
    }) => {
        let href = to
        if (params) {
            for (const [key, value] of Object.entries(params)) {
                href = href.replace(`$${key}`, value)
            }
        }

        const searchParams = new URLSearchParams()
        for (const [key, value] of Object.entries(search ?? {})) {
            if (value) searchParams.set(key, value)
        }

        const query = searchParams.toString()
        return <a href={`${href}${query ? `?${query}` : ''}`} className={className} title={title} aria-label={ariaLabel}>{children}</a>
    },
}))

vi.mock('../../components/layout', () => ({
    SEOHead: () => null,
}))

vi.mock('../../utils/apiClient', () => ({
    apiClient: {
        get: vi.fn().mockResolvedValue({
            data: {
                orgnr: '993144169',
                navn: 'Test AS',
                organisasjonsform: 'AS',
                naeringskode: '62.010',
                antall_ansatte: 12,
                regnskap: [],
            },
        }),
    },
}))

vi.mock('../../utils/clipboard', () => ({
    copyToClipboard: vi.fn(),
}))

vi.mock('../../store/toastStore', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        warning: vi.fn(),
    },
}))

describe('ComparisonPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useComparisonStore.getState().clear()
        mockSearch = { orgnr: '993144169,913352483' }
    })

    it('parses only unique valid org numbers from URL params', () => {
        expect(parseComparisonOrgNumbers(' bad,923609016,923609016, 989795848 ,123456789,111111111,222222222,333333333 '))
            .toEqual(['923609016', '989795848', '123456789', '111111111', '222222222'])
    })

    it('builds a share URL for selected organisations', () => {
        expect(getComparisonShareUrl('https://bedriftsgrafen.no', ['993144169', '913352483']))
            .toBe('https://bedriftsgrafen.no/sammenlign?orgnr=993144169%2C913352483')
    })

    it('shows guided actions when no companies are selected', () => {
        mockSearch = {}

        render(<ComparisonPage />)

        expect(screen.getByRole('heading', { name: 'Velg virksomheter å sammenligne' })).toBeInTheDocument()
        expect(screen.getByText(/Start med et ferdig eksempel/i)).toBeInTheDocument()
        expect(screen.getByRole('link', { name: /Sammenlign Equinor, Aker BP og Vår Energi/i }))
            .toHaveAttribute('href', '/sammenlign?orgnr=923609016%2C989795848%2C919160675')
        expect(screen.getByRole('link', { name: /Finn konkurrenter i samme kommune/i }))
            .toHaveAttribute('href', '/utforsk')
        expect(screen.getByRole('link', { name: /Start fra en virksomhetsside/i }))
            .toHaveAttribute('href', '/virksomhet/984661185')
    })

    it('does not request invalid or duplicate org numbers from URL params', async () => {
        mockSearch = { orgnr: 'bad,923609016,923609016, 989795848 ' }

        render(<ComparisonPage />)

        await waitFor(() => {
            expect(apiClient.get).toHaveBeenCalledTimes(2)
        })
        expect(apiClient.get).toHaveBeenNthCalledWith(1, '/v1/companies/923609016')
        expect(apiClient.get).toHaveBeenNthCalledWith(2, '/v1/companies/989795848')
    })

    it('falls back to selected companies when URL params are malformed', async () => {
        mockSearch = { orgnr: '"932115948"' }
        useComparisonStore.setState({
            companies: [
                { orgnr: '984661185', navn: 'POSTEN BRING AS' },
                { orgnr: '932115948', navn: 'POSTEN EIENDOM ROBSRUD AS' },
            ],
        })

        render(<ComparisonPage />)

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith({
                to: '/sammenlign',
                search: { orgnr: '984661185,932115948' },
                replace: true,
            })
        })
        expect(apiClient.get).toHaveBeenCalledWith('/v1/companies/984661185')
        expect(apiClient.get).toHaveBeenCalledWith('/v1/companies/932115948')
    })

    it('copies the comparison URL and shows feedback', async () => {
        vi.mocked(copyToClipboard).mockResolvedValue(true)

        render(<ComparisonPage />)

        fireEvent.click(screen.getByRole('button', { name: 'Del utvalg' }))

        await waitFor(() => {
            expect(copyToClipboard).toHaveBeenCalledWith('http://localhost:3000/sammenlign?orgnr=993144169%2C913352483')
        })

        expect(toast.success).toHaveBeenCalledWith('Lenke til sammenligningen er kopiert')
        expect(screen.getByRole('button', { name: 'Lenke kopiert' })).toBeInTheDocument()
        expect(screen.getByRole('status')).toHaveTextContent('Lenken er kopiert til utklippstavlen.')
    })

    it('shows a fallback prompt when clipboard copy fails', async () => {
        vi.mocked(copyToClipboard).mockResolvedValue(false)
        const promptSpy = vi.spyOn(window, 'prompt').mockImplementation(() => null)

        render(<ComparisonPage />)

        fireEvent.click(screen.getByRole('button', { name: 'Del utvalg' }))

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith('Kunne ikke kopiere lenken automatisk')
        })

        expect(promptSpy).toHaveBeenCalledWith(
            'Kopier lenken:',
            'http://localhost:3000/sammenlign?orgnr=993144169%2C913352483'
        )
        expect(screen.getByRole('status')).toHaveTextContent('Kunne ikke kopiere automatisk. Kopier lenken fra dialogen.')

        promptSpy.mockRestore()
    })
})