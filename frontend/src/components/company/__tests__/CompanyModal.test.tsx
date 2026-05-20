import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompanyWithAccounting } from '../../../types'
import { CompanyModal } from '../CompanyModal'

vi.mock('../CompanyDetailContent', () => ({
    CompanyDetailContent: ({
        company,
        headingId,
        descriptionId,
    }: {
        company?: { navn?: string; orgnr?: string }
        headingId?: string
        descriptionId?: string
    }) => (
        <div>
            {company ? (
                <>
                    <h1 id={headingId}>{company.navn}</h1>
                    <p id={descriptionId}>Org.nr: {company.orgnr}</p>
                </>
            ) : (
                <p>Laster virksomhetsdetaljer</p>
            )}
        </div>
    ),
}))

const mockCompany: CompanyWithAccounting = {
    orgnr: '123456789',
    navn: 'Test Company AS',
    organisasjonsform: 'AS',
    naeringskode: '62.010',
    postadresse: { adresse: ['Testgate 1'], postnummer: '0301', poststed: 'Oslo', kommune: 'Oslo', kommunenummer: '0301', land: 'Norge' },
    forretningsadresse: { adresse: ['Testgate 1'], postnummer: '0301', poststed: 'Oslo', kommune: 'Oslo', kommunenummer: '0301', land: 'Norge' },
    regnskap: [],
    antall_ansatte: 10,
    konkurs: false,
    under_avvikling: false,
    under_tvangsavvikling: false,
    stiftelsesdato: '2020-01-01',
    registreringsdato_enhetsregisteret: '2020-01-01',
}

const baseProps = {
    company: mockCompany,
    companyLoading: false,
    companyError: false,
    selectedYear: null,
    selectedAccountingId: null,
    onSelectAccounting: vi.fn(),
    kpiData: undefined,
    kpiLoading: false,
    kpiError: false,
    copiedOrgnr: false,
    onCopyOrgnr: vi.fn(),
    onShare: vi.fn(),
    onRetryCompany: vi.fn(),
    onRetryKpi: vi.fn(),
    onImport: vi.fn(),
    isImporting: false,
    activeTab: 'oversikt' as const,
    onTabChange: vi.fn(),
    onClose: vi.fn(),
}

describe('CompanyModal', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'scrollTo', {
            value: vi.fn(),
            writable: true,
        })
    })

    it('uses the company heading as the dialog name when data is available', () => {
        render(<CompanyModal {...baseProps} />)

        const dialog = screen.getByRole('dialog', { name: 'Test Company AS' })
        expect(dialog).toHaveAttribute('aria-describedby')
        expect(screen.getByText('Org.nr: 123456789')).toBeInTheDocument()
    })

    it('falls back to a generic dialog label while loading', () => {
        render(
            <CompanyModal
                {...baseProps}
                company={undefined}
                companyLoading
            />,
        )

        expect(screen.getByRole('dialog', { name: 'Virksomhetsdetaljer' })).toBeInTheDocument()
    })
})