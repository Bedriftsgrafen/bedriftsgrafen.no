/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PersonOverviewTab } from '../PersonOverviewTab'
import type { PersonToplistResponse, PersonAggregateStats } from '../../../types/person'

// Mock router Link
vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, ...props }: any) => <a data-testid="person-link" {...props}>{children}</a>,
}))

// Mock recharts (avoids jsdom SVG issues)
vi.mock('recharts', () => ({
    PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
    Pie: () => null,
    Cell: () => null,
    BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    Tooltip: () => null,
    Legend: () => null,
}))

const MOCK_TOPLISTS: PersonToplistResponse[] = [
    {
        category: 'active_roles',
        entries: [
            { rank: 1, name: 'Ola Nordmann', birth_year: 1970, value: 120, active_roles: 120, active_companies: 45 },
            { rank: 2, name: 'Kari Hansen', birth_year: 1965, value: 98, active_roles: 98, active_companies: 32 },
        ],
    },
    {
        category: 'LEDE',
        entries: [
            { rank: 1, name: 'Trude Moen', birth_year: 1972, value: 50, active_roles: 80, active_companies: 50 },
        ],
    },
    {
        category: 'salgsinntekter',
        entries: [
            { rank: 1, name: 'Stor Bedrift', birth_year: 1955, value: 5_000_000_000, active_roles: 8, active_companies: 5 },
        ],
    },
    {
        category: 'total_profit',
        entries: [
            { rank: 1, name: 'Lønnsom Gründer', birth_year: 1968, value: 2_000_000_000, active_roles: 6, active_companies: 4 },
        ],
    },
    {
        category: 'total_employees',
        entries: [
            { rank: 1, name: 'Stor Arbeidsgiver', birth_year: 1962, value: 25000, active_roles: 3, active_companies: 2 },
        ],
    },
]

const MOCK_STATS: PersonAggregateStats = {
    total_persons: 906050,
    total_active_roles: 1842630,
    avg_board_age: 53,
    role_type_distribution: [
        { type_kode: 'MEDL', type_beskrivelse: 'Styremedlem', count: 580000 },
    ],
    generation_distribution: [
        { generation: 'Gen X', birth_year_range: '1965-1980', count: 531000 },
    ],
}

describe('PersonOverviewTab', () => {
    it('renders category headings', () => {
        render(
            <PersonOverviewTab toplists={MOCK_TOPLISTS} stats={MOCK_STATS} onTabChange={vi.fn()} />
        )

        expect(screen.getByText('Flest aktive roller')).toBeInTheDocument()
        expect(screen.getByText('Flest styreleder')).toBeInTheDocument()
        expect(screen.getByText('Størst omsetning')).toBeInTheDocument()
        expect(screen.getByText('Størst overskudd')).toBeInTheDocument()
        expect(screen.getByText('Flest ansatte')).toBeInTheDocument()
    })

    it('renders person names in toplist entries', () => {
        render(
            <PersonOverviewTab toplists={MOCK_TOPLISTS} stats={MOCK_STATS} onTabChange={vi.fn()} />
        )

        expect(screen.getByText('Ola Nordmann')).toBeInTheDocument()
        expect(screen.getByText('Kari Hansen')).toBeInTheDocument()
        expect(screen.getByText('Trude Moen')).toBeInTheDocument()
    })

    it('renders formatted values', () => {
        render(
            <PersonOverviewTab toplists={MOCK_TOPLISTS} stats={MOCK_STATS} onTabChange={vi.fn()} />
        )

        // formatNumber(120) should produce a localized number
        expect(screen.getByText('120')).toBeInTheDocument()
    })

    it('calls onTabChange when "Se alle" is clicked', () => {
        const onTabChange = vi.fn()
        render(
            <PersonOverviewTab toplists={MOCK_TOPLISTS} stats={MOCK_STATS} onTabChange={onTabChange} />
        )

        const seeAllButtons = screen.getAllByText('Se alle')
        fireEvent.click(seeAllButtons[0])

        expect(onTabChange).toHaveBeenCalledWith('topplister')
    })

    it('renders charts when stats are provided', () => {
        render(
            <PersonOverviewTab toplists={MOCK_TOPLISTS} stats={MOCK_STATS} onTabChange={vi.fn()} />
        )

        expect(screen.getByText('Generasjonsfordeling')).toBeInTheDocument()
        expect(screen.getByText('Rolletyper')).toBeInTheDocument()
    })

    it('does not render charts when stats are undefined', () => {
        render(
            <PersonOverviewTab toplists={MOCK_TOPLISTS} stats={undefined} onTabChange={vi.fn()} />
        )

        expect(screen.queryByText('Generasjonsfordeling')).not.toBeInTheDocument()
        expect(screen.queryByText('Rolletyper')).not.toBeInTheDocument()
    })

    it('renders empty state gracefully with no toplists', () => {
        render(
            <PersonOverviewTab toplists={[]} stats={MOCK_STATS} onTabChange={vi.fn()} />
        )

        expect(screen.queryByText('Se alle')).not.toBeInTheDocument()
    })

    it('formats revenue values with formatCurrency for salgsinntekter category', () => {
        render(
            <PersonOverviewTab toplists={MOCK_TOPLISTS} stats={MOCK_STATS} onTabChange={vi.fn()} />
        )
        // formatCurrency(5_000_000_000) = '5.0 mrd'
        expect(screen.getByText('5.0 mrd')).toBeInTheDocument()
    })
})
