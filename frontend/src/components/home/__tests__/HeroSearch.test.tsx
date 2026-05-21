import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HeroSearch } from '../HeroSearch'
import { useCompanySearchQuery } from '../../../hooks/queries/useCompanySearchQuery'
import { usePersonSearchQuery } from '../../../hooks/queries/usePersonSearchQuery'
import { useStatsQuery } from '../../../hooks/queries/useStatsQuery'
import { useFilterStore } from '../../../store/filterStore'
import { useUiStore } from '../../../store/uiStore'

const mockNavigate = vi.fn()
const mockAddRecentSearch = vi.fn()
const mockClearFilters = vi.fn()

const mockUseUiStore = vi.mocked(useUiStore) as unknown as {
    mockImplementation: (implementation: (selector: (state: { addRecentSearch: typeof mockAddRecentSearch }) => unknown) => unknown) => void
}
const mockUseFilterStore = vi.mocked(useFilterStore) as unknown as {
    mockImplementation: (implementation: (selector: (state: { clearFilters: typeof mockClearFilters }) => unknown) => unknown) => void
}

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => mockNavigate,
    Link: ({ children, to, params, search, ...props }: {
        children: ReactNode
        to: string
        params?: Record<string, string>
        search?: Record<string, string>
    }) => {
        let href = to
        if (params?.orgnr) href = href.replace('$orgnr', params.orgnr)
        if (params?.name) href = href.replace('$name', params.name)
        if (params?.birthdate) href = href.replace('$birthdate', params.birthdate)
        if (search?.q) href = `${href}?q=${encodeURIComponent(search.q)}`

        return <a href={href} {...props}>{children}</a>
    },
}))

vi.mock('../../../hooks/queries/useCompanySearchQuery', () => ({
    useCompanySearchQuery: vi.fn(),
}))

vi.mock('../../../hooks/queries/usePersonSearchQuery', () => ({
    usePersonSearchQuery: vi.fn(),
}))

vi.mock('../../../hooks/queries/useStatsQuery', () => ({
    useStatsQuery: vi.fn(),
}))

vi.mock('../../../store/filterStore', () => ({
    useFilterStore: vi.fn(),
}))

vi.mock('../../../store/uiStore', () => ({
    useUiStore: vi.fn(),
}))

async function revealSearchPanel() {
    fireEvent.pointerDown(window)
    return screen.findByRole('combobox', { name: 'Søk etter virksomhet eller person' })
}

describe('HeroSearch', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(useStatsQuery).mockReturnValue({ data: { total_companies: 1162204 } } as ReturnType<typeof useStatsQuery>)
        vi.mocked(useCompanySearchQuery).mockReturnValue({ data: [], isFetching: false } as unknown as ReturnType<typeof useCompanySearchQuery>)
        vi.mocked(usePersonSearchQuery).mockReturnValue({ data: [], isFetching: false } as unknown as ReturnType<typeof usePersonSearchQuery>)
        mockUseUiStore.mockImplementation((selector) => selector({ addRecentSearch: mockAddRecentSearch }))
        mockUseFilterStore.mockImplementation((selector) => selector({ clearFilters: mockClearFilters }))
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('shows company suggestions that link directly to company pages', async () => {
        vi.mocked(useCompanySearchQuery).mockReturnValue({
            data: [{ orgnr: '923609016', navn: 'EQUINOR ENERGY AS', organisasjonsform: 'AS' }],
            isFetching: false,
        } as unknown as ReturnType<typeof useCompanySearchQuery>)

        render(<HeroSearch />)

        fireEvent.change(await revealSearchPanel(), {
            target: { value: 'equinor' },
        })

        expect(await screen.findByRole('link', { name: /Åpne EQUINOR ENERGY AS/i })).toHaveAttribute(
            'href',
            '/virksomhet/923609016'
        )
    })

    it('blocks broad two-character company searches before navigation', async () => {
        render(<HeroSearch />)

        fireEvent.change(await revealSearchPanel(), {
            target: { value: 'as' },
        })

        expect(screen.getByText('Skriv minst 3 tegn for virksomhetssøk.')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Søk etter virksomhet' })).toBeDisabled()
        expect(mockNavigate).not.toHaveBeenCalled()
    })
})