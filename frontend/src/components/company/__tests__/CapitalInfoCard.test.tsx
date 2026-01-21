import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { CapitalInfoCard } from '../CapitalInfoCard'

describe('CapitalInfoCard', () => {
    const defaultProps = {}

    it('formats aksjekapital with formatCurrency', () => {
        render(<CapitalInfoCard {...defaultProps} aksjekapital={6392018780} />)

        expect(screen.getByText('Aksjekapital')).toBeInTheDocument()
        // formatCurrency should format as "6,39 mrd"
        expect(screen.getByText(/mrd/)).toBeInTheDocument()
    })

    it('formats antall aksjer with thousand separators', () => {
        render(<CapitalInfoCard {...defaultProps} antallAksjer={2556807512} />)

        expect(screen.getByText('Antall aksjer')).toBeInTheDocument()
        // Norwegian locale uses space as thousand separator
        expect(screen.getByText(/556/)).toBeInTheDocument()
    })

    it('shows konsern link when erIKonsern is true', () => {
        render(<CapitalInfoCard {...defaultProps} erIKonsern={true} />)

        const konsernText = screen.getByText(/Del av konsern/i)
        expect(konsernText).toBeInTheDocument()
        expect(konsernText.tagName).toBe('SPAN')
    })

    it('hides konsern section when erIKonsern is false', () => {
        render(<CapitalInfoCard {...defaultProps} erIKonsern={false} />)

        expect(screen.queryByText(/Del av konsern/)).not.toBeInTheDocument()
    })

    it('hides konsern section when erIKonsern is undefined', () => {
        render(<CapitalInfoCard {...defaultProps} />)

        expect(screen.queryByText(/Del av konsern/)).not.toBeInTheDocument()
    })

    it('displays siste regnskapsår', () => {
        render(<CapitalInfoCard {...defaultProps} sisteRegnskapsaar="2024" />)

        expect(screen.getByText('Siste regnskap')).toBeInTheDocument()
        expect(screen.getByText('2024')).toBeInTheDocument()
    })

    it('displays institusjonell sektor', () => {
        render(<CapitalInfoCard {...defaultProps} institusjonellSektor="Statlig eide aksjeselskaper mv." />)

        expect(screen.getByText('Sektor')).toBeInTheDocument()
        expect(screen.getByText('Statlig eide aksjeselskaper mv.')).toBeInTheDocument()
    })

    it('returns null when no capital info is provided', () => {
        const { container } = render(<CapitalInfoCard {...defaultProps} />)
        expect(container.firstChild).toBeNull()
    })

    it('renders all fields when fully populated', () => {
        render(
            <CapitalInfoCard
                aksjekapital={30000}
                antallAksjer={30}
                sisteRegnskapsaar="2024"
                erIKonsern={true}
                institusjonellSektor="Private aksjeselskaper mv."
            />
        )

        expect(screen.getByText('Aksjekapital')).toBeInTheDocument()
        expect(screen.getByText('Antall aksjer')).toBeInTheDocument()
        expect(screen.getByText('Siste regnskap')).toBeInTheDocument()
        expect(screen.getByText(/Del av konsern/)).toBeInTheDocument()
        expect(screen.getByText('Sektor')).toBeInTheDocument()
    })
})
