import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompanyWithAccounting } from '../../../types'
import { useComparisonStore } from '../../../store/comparisonStore'
import { ComparisonModal } from '../ComparisonModal'

const mockGet = vi.fn()

vi.mock('../../../utils/apiClient', () => ({
    apiClient: {
        get: (...args: unknown[]) => mockGet(...args),
    },
}))

vi.mock('../../ads/AffiliateBanner', () => ({
    AffiliateBanner: () => <div data-testid="comparison-affiliate" />,
}))

function createCompany(orgnr: string, navn: string): CompanyWithAccounting {
    return {
        orgnr,
        navn,
        organisasjonsform: 'AS',
        naeringskode: '62.010',
        postadresse: { adresse: ['Testgate 1'], postnummer: '0301', poststed: 'Oslo', kommune: 'Oslo', kommunenummer: '0301', land: 'Norge' },
        forretningsadresse: { adresse: ['Testgate 1'], postnummer: '0301', poststed: 'Oslo', kommune: 'Oslo', kommunenummer: '0301', land: 'Norge' },
        regnskap: [],
        antall_ansatte: 4,
        konkurs: false,
        under_avvikling: false,
        under_tvangsavvikling: false,
        stiftelsesdato: '2020-01-01',
        registreringsdato_enhetsregisteret: '2020-01-01',
    }
}

const selectedCompanies = [
    { orgnr: '123456789', navn: 'Første Test AS' },
    { orgnr: '987654321', navn: 'Andre Test AS' },
]

function ComparisonModalHarness() {
    return (
        <>
            <button
                type="button"
                onClick={(event) => {
                    event.currentTarget.focus()
                    useComparisonStore.setState({
                        companies: selectedCompanies,
                        isModalOpen: true,
                    })
                }}
            >
                Åpne sammenligning
            </button>
            <ComparisonModal />
        </>
    )
}

describe('ComparisonModal', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'scrollTo', {
            value: vi.fn(),
            writable: true,
        })

        useComparisonStore.setState({ companies: [], isModalOpen: false })
        mockGet.mockReset()
        mockGet.mockImplementation(async (url: string) => {
            const orgnr = url.split('/').pop() || '123456789'
            return { data: createCompany(orgnr, orgnr === '123456789' ? 'Første Test AS' : 'Andre Test AS') }
        })
    })

    it('opens as a named dialog and restores focus to the trigger on Escape', async () => {
        render(<ComparisonModalHarness />)

        const trigger = screen.getByRole('button', { name: 'Åpne sammenligning' })
        fireEvent.click(trigger)

        const dialog = screen.getByRole('dialog', { name: 'Sammenligning av 2 virksomheter' })
        expect(dialog).toHaveAttribute('aria-describedby')
        expect(screen.getAllByRole('button', { name: 'Lukk' })[0]).toHaveFocus()

        fireEvent.keyDown(document, { key: 'Escape' })

        await waitFor(() => {
            expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        })

        expect(trigger).toHaveFocus()
    })
})