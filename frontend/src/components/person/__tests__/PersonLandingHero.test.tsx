/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PersonLandingHero } from '../PersonLandingHero'
import type { PersonAggregateStats } from '../../../types/person'

// Mock SummaryCard to simplify assertions
vi.mock('../../common/SummaryCard', () => ({
    SummaryCard: ({ label, value, loading }: any) => (
        <div data-testid={`summary-${label}`}>
            {loading ? 'Loading...' : value}
        </div>
    ),
}))

const MOCK_STATS: PersonAggregateStats = {
    total_persons: 906050,
    total_active_roles: 1842630,
    avg_board_age: 53,
    role_type_distribution: [],
    generation_distribution: [],
}

describe('PersonLandingHero', () => {
    it('renders heading and description with stats', () => {
        render(<PersonLandingHero stats={MOCK_STATS} loading={false} />)

        expect(screen.getByText('Personer')).toBeInTheDocument()
        // Stats value appears in description and summary card
        expect(screen.getAllByText(/906\s?050/).length).toBeGreaterThanOrEqual(1)
    })

    it('renders summary cards with formatted values', () => {
        render(<PersonLandingHero stats={MOCK_STATS} loading={false} />)

        expect(screen.getByTestId('summary-Unike personer')).toBeInTheDocument()
        expect(screen.getByTestId('summary-Aktive roller')).toBeInTheDocument()
        expect(screen.getByTestId('summary-Snittalder styremedlemmer')).toBeInTheDocument()
    })

    it('shows loading state when loading', () => {
        render(<PersonLandingHero stats={undefined} loading={true} />)

        expect(screen.getByTestId('summary-Unike personer')).toHaveTextContent('Loading...')
    })

    it('shows fallback text when stats not yet loaded', () => {
        render(<PersonLandingHero stats={undefined} loading={false} />)

        expect(screen.getByText(/Utforsk \.\.\. personer/)).toBeInTheDocument()
    })
})
