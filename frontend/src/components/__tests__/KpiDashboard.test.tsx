import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { KpiDashboard } from '../KpiDashboard'
import { AccountingWithKpis } from '../../types'

// Mock data
const mockData: AccountingWithKpis = {
    id: 1,
    // orgnr: '123456789',
    aar: 2023,
    total_inntekt: 1000000,
    aarsresultat: 50000,
    egenkapital: 200000,
    gjeldsgrad: 2.5,
    driftsresultat: 75000,
    salgsinntekter: 900000,
    omloepsmidler: 300000,
    sum_eiendeler: 700000,
    kortsiktig_gjeld: 150000,
    avskrivninger: 25000,
    // anleggsmidler: 400000,
    // langsiktig_gjeld: 350000,
    // raw_data: {},
    kpis: {
        likviditetsgrad1: 2.0,
        ebitda_margin: 0.11,
        egenkapitalandel: 0.28,
        ebitda: 100000,
        resultatgrad: 0.05,
        totalkapitalrentabilitet: 0.08
    }
}

describe('KpiDashboard', () => {
    it('renders financial overview correctly', () => {
        render(<KpiDashboard data={mockData} />)

        // Check main labels
        expect(screen.getByText('Salgsinntekter')).toBeInTheDocument()
        expect(screen.getByText('Årsresultat')).toBeInTheDocument()
        expect(screen.getByText('Egenkapital')).toBeInTheDocument()

        // Check specific values exist (use getAllByText for potential duplicates)
        expect(screen.getByText(/900\s000\skr/)).toBeInTheDocument() // Salgsinntekter
    })

    it('renders KPI cards with correct values', () => {
        render(<KpiDashboard data={mockData} />)

        // Check KPI values - these are now formatted as percentages
        expect(screen.getByText('200.0%')).toBeInTheDocument() // Likviditetsgrad (2.0 * 100)
        expect(screen.getByText('11.0%')).toBeInTheDocument() // EBITDA-margin
        expect(screen.getByText('28.0%')).toBeInTheDocument() // Egenkapitalandel
    })

    it('applies correct color classes based on values', () => {
        render(<KpiDashboard data={mockData} />)

        // Likviditetsgrad 200% should be green
        const liquidityValue = screen.getByText('200.0%')
        expect(liquidityValue).toHaveClass('text-green-700')

        // EBITDA margin 11% should be green
        const ebitdaValue = screen.getByText('11.0%')
        expect(ebitdaValue).toHaveClass('text-green-700')
    })

    it('renders detailed financial table', () => {
        render(<KpiDashboard data={mockData} />)

        expect(screen.getByText('Driftsresultat')).toBeInTheDocument()
        expect(screen.getByText(/75\s000\skr/)).toBeInTheDocument()

        expect(screen.getByText('Kortsiktig gjeld')).toBeInTheDocument()
        expect(screen.getByText(/150\s000\skr/)).toBeInTheDocument()
    })
})

