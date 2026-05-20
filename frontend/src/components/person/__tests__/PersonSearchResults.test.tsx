import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PersonSearchResults } from '../PersonSearchResults'
import type { PaginatedPersonSearch } from '../../../types/person'

// Mock heavy hooks
vi.mock('../../../hooks/queries/usePersonSearchResultsQuery', () => ({
    usePersonSearchResultsQuery: vi.fn(),
}))
vi.mock('../../../hooks/useSlowLoadingToast', () => ({
    useSlowLoadingToast: vi.fn(),
}))

// Mock sub-components to keep tests focused
vi.mock('../PersonResultCard', () => ({
    PersonResultCard: ({ person }: { person: { name: string } }) => (
        <div data-testid="person-card">{person.name}</div>
    ),
}))
vi.mock('../PersonResultRow', () => ({
    PersonResultRow: ({ person }: { person: { name: string } }) => (
        <tr data-testid="person-row"><td>{person.name}</td></tr>
    ),
}))
vi.mock('../../common', () => ({
    Pagination: () => <div data-testid="pagination" />,
}))

import { usePersonSearchResultsQuery } from '../../../hooks/queries/usePersonSearchResultsQuery'
const mockQuery = usePersonSearchResultsQuery as ReturnType<typeof vi.fn>

const defaultProps = {
    query: 'Kari',
    sortBy: 'role_count' as const,
    sortOrder: 'desc' as const,
    viewMode: 'cards' as const,
    currentPage: 1,
    onPageChange: vi.fn(),
    onSortChange: vi.fn(),
    onViewModeChange: vi.fn(),
}

const mockResults: PaginatedPersonSearch = {
    results: [
        {
            name: 'Kari Nordmann',
            birthdate: '1985-01-01',
            role_count: 3,
            active_role_count: 2,
            top_roles: ['Styreleder'],
            notable_companies: ['Test AS'],
        },
        {
            name: 'Kari Hansen',
            birthdate: '1990-05-10',
            role_count: 1,
            active_role_count: 1,
            top_roles: [],
            notable_companies: [],
        },
    ],
    total_count: 2,
    query: 'Kari',
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('PersonSearchResults — loading state', () => {
    it('shows skeleton when loading', () => {
        mockQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false })
        render(<PersonSearchResults {...defaultProps} />)
        expect(screen.getByText('Søker...')).toBeInTheDocument()
    })

    it('marks the result count region busy while loading', () => {
        mockQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false })
        render(<PersonSearchResults {...defaultProps} />)
        expect(screen.getByText('Søker...').closest('[aria-live="polite"]')).toHaveAttribute('aria-busy', 'true')
    })

    it('does not show cards while loading', () => {
        mockQuery.mockReturnValue({ data: undefined, isLoading: true, isError: false })
        render(<PersonSearchResults {...defaultProps} />)
        expect(screen.queryByTestId('person-card')).not.toBeInTheDocument()
    })
})

describe('PersonSearchResults — error state', () => {
    it('shows error message', () => {
        mockQuery.mockReturnValue({ data: undefined, isLoading: false, isError: true })
        render(<PersonSearchResults {...defaultProps} />)
        expect(screen.getByText('Kunne ikke utføre søket. Prøv igjen.')).toBeInTheDocument()
    })
})

describe('PersonSearchResults — empty state', () => {
    it('shows no-results message', () => {
        mockQuery.mockReturnValue({
            data: { results: [], total_count: 0, query: 'Kari' },
            isLoading: false,
            isError: false,
        })
        render(<PersonSearchResults {...defaultProps} />)
        expect(screen.getByText(/Ingen personer funnet/)).toBeInTheDocument()
        expect(screen.getByText(/Kari/)).toBeInTheDocument()
    })
})

describe('PersonSearchResults — results in card view', () => {
    it('renders a card for each result', () => {
        mockQuery.mockReturnValue({ data: mockResults, isLoading: false, isError: false })
        render(<PersonSearchResults {...defaultProps} />)
        expect(screen.getAllByTestId('person-card')).toHaveLength(2)
        expect(screen.getByText('Kari Nordmann')).toBeInTheDocument()
        expect(screen.getByText('Kari Hansen')).toBeInTheDocument()
    })

    it('shows result count', () => {
        mockQuery.mockReturnValue({ data: mockResults, isLoading: false, isError: false })
        render(<PersonSearchResults {...defaultProps} />)
        expect(screen.getByText('2 personer funnet')).toBeInTheDocument()
    })

    it('shows pagination', () => {
        mockQuery.mockReturnValue({ data: mockResults, isLoading: false, isError: false })
        render(<PersonSearchResults {...defaultProps} />)
        expect(screen.getByTestId('pagination')).toBeInTheDocument()
    })
})

describe('PersonSearchResults — results in list view', () => {
    it('renders a row for each result in list mode', () => {
        mockQuery.mockReturnValue({ data: mockResults, isLoading: false, isError: false })
        render(<PersonSearchResults {...defaultProps} viewMode="list" />)
        expect(screen.getAllByTestId('person-row')).toHaveLength(2)
    })

    it('does not render cards in list mode', () => {
        mockQuery.mockReturnValue({ data: mockResults, isLoading: false, isError: false })
        render(<PersonSearchResults {...defaultProps} viewMode="list" />)
        expect(screen.queryByTestId('person-card')).not.toBeInTheDocument()
    })
})

describe('PersonSearchResults — toolbar interactions', () => {
    it('calls onSortChange when sort is changed', () => {
        mockQuery.mockReturnValue({ data: mockResults, isLoading: false, isError: false })
        const onSortChange = vi.fn()
        render(<PersonSearchResults {...defaultProps} onSortChange={onSortChange} />)
        const select = screen.getByRole('combobox', { name: 'Sortering' })
        fireEvent.change(select, { target: { value: 'name' } })
        expect(onSortChange).toHaveBeenCalledWith('name')
    })

    it('calls onViewModeChange when list button is clicked', () => {
        mockQuery.mockReturnValue({ data: mockResults, isLoading: false, isError: false })
        const onViewModeChange = vi.fn()
        render(<PersonSearchResults {...defaultProps} onViewModeChange={onViewModeChange} />)
        fireEvent.click(screen.getByRole('button', { name: 'Listevisning' }))
        expect(onViewModeChange).toHaveBeenCalledWith('list')
    })

    it('calls onViewModeChange when card button is clicked', () => {
        mockQuery.mockReturnValue({ data: mockResults, isLoading: false, isError: false })
        const onViewModeChange = vi.fn()
        render(<PersonSearchResults {...defaultProps} viewMode="list" onViewModeChange={onViewModeChange} />)
        fireEvent.click(screen.getByRole('button', { name: 'Kortvisning' }))
        expect(onViewModeChange).toHaveBeenCalledWith('cards')
    })

    it('shows sort direction indicator for active sort field', () => {
        mockQuery.mockReturnValue({ data: mockResults, isLoading: false, isError: false })
        render(<PersonSearchResults {...defaultProps} sortBy="role_count" sortOrder="desc" />)
        // The active option shows ↓ for desc
        expect(screen.getByRole('combobox', { name: 'Sortering' }).textContent).toContain('↓')
    })
})

describe('PersonSearchResults — singular person count', () => {
    it('uses singular when exactly one result', () => {
        mockQuery.mockReturnValue({
            data: { results: [mockResults.results[0]], total_count: 1, query: 'Kari' },
            isLoading: false,
            isError: false,
        })
        render(<PersonSearchResults {...defaultProps} />)
        expect(screen.getByText('1 person funnet')).toBeInTheDocument()
    })
})
