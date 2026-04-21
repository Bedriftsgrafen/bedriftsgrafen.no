/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PersonGenerationChart } from '../PersonGenerationChart'
import type { GenerationCount } from '../../../types/person'

// Mock recharts to avoid jsdom SVG issues while still capturing data props
vi.mock('recharts', () => ({
    PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
    Pie: ({ data }: any) => <div data-testid="pie" data-entries={JSON.stringify(data?.map((d: any) => d.name))} />,
    Cell: ({ fill }: any) => <div data-testid="cell" data-fill={fill} />,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    Tooltip: () => null,
    Legend: () => null,
}))

const MOCK_DATA_UNSORTED: GenerationCount[] = [
    { generation: 'Gen Z', birth_year_range: '1997-2012', count: 45000 },
    { generation: 'Silent', birth_year_range: '1928-1945', count: 12000 },
    { generation: 'Millennials', birth_year_range: '1981-1996', count: 210000 },
    { generation: 'Boomers', birth_year_range: '1946-1964', count: 180000 },
    { generation: 'Gen X', birth_year_range: '1965-1980', count: 531000 },
]

describe('PersonGenerationChart', () => {
    it('renders the chart container', () => {
        const { getByTestId } = render(<PersonGenerationChart data={MOCK_DATA_UNSORTED} />)
        expect(getByTestId('pie-chart')).toBeInTheDocument()
    })

    it('returns null when data is empty', () => {
        const { container } = render(<PersonGenerationChart data={[]} />)
        expect(container.firstChild).toBeNull()
    })

    it('sorts generations chronologically (Silent → Boomers → Gen X → Millennials → Gen Z)', () => {
        const { getByTestId } = render(<PersonGenerationChart data={MOCK_DATA_UNSORTED} />)
        const pie = getByTestId('pie')
        const names: string[] = JSON.parse(pie.dataset.entries ?? '[]')

        expect(names[0]).toContain('Silent')
        expect(names[1]).toContain('Boomers')
        expect(names[2]).toContain('Gen X')
        expect(names[3]).toContain('Millennials')
        expect(names[4]).toContain('Gen Z')
    })

    it('preserves all 5 generations in output', () => {
        const { getByTestId } = render(<PersonGenerationChart data={MOCK_DATA_UNSORTED} />)
        const pie = getByTestId('pie')
        const names: string[] = JSON.parse(pie.dataset.entries ?? '[]')
        expect(names).toHaveLength(5)
    })

    it('handles unknown generation without crashing (sorts last)', () => {
        const withUnknown: GenerationCount[] = [
            ...MOCK_DATA_UNSORTED,
            { generation: 'Alpha', birth_year_range: '2013-2025', count: 5000 },
        ]
        const { getByTestId } = render(<PersonGenerationChart data={withUnknown} />)
        const pie = getByTestId('pie')
        const names: string[] = JSON.parse(pie.dataset.entries ?? '[]')
        // Known 5 come first; Alpha sorts last (order 99)
        expect(names).toHaveLength(6)
        expect(names[names.length - 1]).toContain('Alpha')
    })
})
