import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CompanyModalHeader } from '../CompanyModalHeader'
import type { CompanyWithAccounting } from '../../../types'

// Mock the stores
vi.mock('../../../store/favoritesStore', () => ({
    useFavoritesStore: vi.fn(() => false)
}))
vi.mock('../../../store/comparisonStore', () => ({
    useComparisonStore: vi.fn(() => ({
        isSelected: () => false,
        companies: []
    }))
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
    registreringsdato_enhetsregisteret: '2020-01-01'
}

describe('CompanyModalHeader', () => {
    const defaultProps = {
        company: mockCompany,
        isLoading: false,
        isError: false,
        copiedOrgnr: false,
        onCopyOrgnr: vi.fn(),
        onShare: vi.fn(),
        onClose: vi.fn(),
        onRetry: vi.fn()
    }

    it('renders correctly with company data', () => {
        render(<CompanyModalHeader {...defaultProps} />)
        expect(screen.getByText('Test Company AS')).toBeDefined()
        expect(screen.getByText('Org.nr: 123456789')).toBeDefined()
    })

    it('contains a valid LinkedIn search link and strips suffixes', () => {
        render(<CompanyModalHeader {...defaultProps} />)

        // Test Company AS -> Test Company
        const linkedinLink = screen.getByLabelText(/Søk etter Test Company AS på LinkedIn/i) as HTMLAnchorElement

        expect(linkedinLink).toBeDefined()
        expect(linkedinLink.tagName).toBe('A')
        expect(linkedinLink.target).toBe('_blank')
        expect(linkedinLink.rel).toContain('noopener')
        expect(linkedinLink.rel).toContain('noreferrer')

        // Check URL and encoding - suffix 'AS' should be stripped
        const encodedName = encodeURIComponent('Test Company')
        expect(linkedinLink.href).toBe(`https://www.linkedin.com/search/results/companies/?keywords=${encodedName}`)
    })

    it('strips ASA and other suffixes for LinkedIn search', () => {
        const asaCompany = { ...mockCompany, navn: 'Equinor ASA' }
        render(<CompanyModalHeader {...defaultProps} company={asaCompany} />)

        const linkedinLink = screen.getByLabelText(/Søk etter Equinor ASA på LinkedIn/i) as HTMLAnchorElement
        const encodedName = encodeURIComponent('Equinor')
        expect(linkedinLink.href).toBe(`https://www.linkedin.com/search/results/companies/?keywords=${encodedName}`)
    })

    it('does not render LinkedIn link when company is undefined', () => {
        render(<CompanyModalHeader {...defaultProps} company={undefined} />)
        const linkedinLink = screen.queryByLabelText(/på LinkedIn/i)
        expect(linkedinLink).toBeNull()
    })
})
