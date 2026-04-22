/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { BenchmarkCard } from '../BenchmarkCard'
import { Landmark } from 'lucide-react'

// Mock Recharts to avoid issues with ResponsiveContainer and jsdom
vi.mock('recharts', () => ({
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    BarChart: ({ children }: any) => <div>{children}</div>,
    Bar: () => <div />,
    XAxis: () => <div />,
    YAxis: () => <div />,
    Tooltip: () => <div />,
}))

describe('BenchmarkCard', () => {
    const defaultMetric = {
        company_value: 1000,
        industry_avg: 800,
        industry_median: 750,
        percentile: 75
    }

    const mockFormatter = (val: number | null) => val !== null ? `${val} kr` : 'N/A'

    it('renders correctly with full data', () => {
        render(
            <BenchmarkCard
                title="Omsetning"
                metric={defaultMetric}
                icon={<Landmark data-testid="icon" />}
                formatter={mockFormatter}
                color="bg-blue-500"
            />
        )

        expect(screen.getByText('Omsetning')).toBeInTheDocument()
        expect(screen.getByText('1000 kr')).toBeInTheDocument()
        expect(screen.getByText('Topp 25%')).toBeInTheDocument()
        expect(screen.getByText(/\+25.0%/)).toBeInTheDocument()
        expect(screen.getByText(/vs bransjesnitt \(800 kr\)/)).toBeInTheDocument()
    })

    it('renders with null company_value (Bankrupt case)', () => {
        const bankruptMetric = {
            company_value: null,
            industry_avg: 500,
            industry_median: 450,
            percentile: null
        }

        render(
            <BenchmarkCard
                title="Resultat"
                metric={bankruptMetric as any}
                icon={<Landmark />}
                formatter={mockFormatter}
                color="bg-red-500"
            />
        )

        // Title should be present
        expect(screen.getByText('Resultat')).toBeInTheDocument()

        // Formatted null value
        expect(screen.getByText('N/A')).toBeInTheDocument()

        // Should STILL show industry average comparison
        expect(screen.getByText(/vs bransjesnitt \(500 kr\)/)).toBeInTheDocument()

        // Percentile should be hidden
        expect(screen.queryByText(/Topp/)).not.toBeInTheDocument()
    })

    it('returns null if industry_avg is null', () => {
        const nullMetric = {
            company_value: 100,
            industry_avg: null,
            industry_median: null,
            percentile: 50
        }

        const { container } = render(
            <BenchmarkCard
                title="Test"
                metric={nullMetric as any}
                icon={<Landmark />}
                formatter={mockFormatter}
                color="bg-gray-500"
            />
        )

        expect(container.firstChild).toBeNull()
    })
})
