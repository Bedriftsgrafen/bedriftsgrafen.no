import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { copyToClipboard } from '../../utils/clipboard'
import { toast } from '../../store/toastStore'
import { ComparisonPage, getComparisonShareUrl } from '../sammenlign.lazy'

let mockSearch: { orgnr?: string } = { orgnr: '993144169,913352483' }
const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createLazyFileRoute: () => (config: any) => ({
        useSearch: () => mockSearch,
        useNavigate: () => mockNavigate,
        ...config,
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Link: ({ children, className, title, 'aria-label': ariaLabel }: any) => (
        <a href="#" className={className} title={title} aria-label={ariaLabel}>{children}</a>
    ),
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
        mockSearch = { orgnr: '993144169,913352483' }
    })

    it('builds a share URL for selected organisations', () => {
        expect(getComparisonShareUrl('https://bedriftsgrafen.no', ['993144169', '913352483']))
            .toBe('https://bedriftsgrafen.no/sammenlign?orgnr=993144169%2C913352483')
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