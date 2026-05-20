import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ComparisonBar } from '../ComparisonBar'
import { useComparisonStore } from '../../../store/comparisonStore'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => mockNavigate,
}))

vi.mock('../../../store/toastStore', () => ({
    toast: {
        success: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
    },
}))

describe('ComparisonBar', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useComparisonStore.setState({
            companies: [],
            isModalOpen: false,
        })
    })

    it('does not render without selected companies', () => {
        const { container } = render(<ComparisonBar />)

        expect(container).toBeEmptyDOMElement()
    })

    it('renders selected companies above map overlays', () => {
        useComparisonStore.setState({
            companies: [
                { orgnr: '993144169', navn: 'VARDE HARTMARK AS' },
                { orgnr: '913352483', navn: 'TESTSELSKAP AS' },
            ],
        })

        const { container } = render(<ComparisonBar />)

        expect(container.firstElementChild).toHaveClass('fixed', 'z-1500')
        expect(screen.getByText('Sammenlign (2/3):')).toBeInTheDocument()
        expect(screen.getByText('VARDE HARTMARK AS')).toBeInTheDocument()
        expect(screen.getByText('TESTSELSKAP AS')).toBeInTheDocument()
    })

    it('navigates to the comparison page with selected org numbers', () => {
        useComparisonStore.setState({
            companies: [
                { orgnr: '993144169', navn: 'VARDE HARTMARK AS' },
                { orgnr: '913352483', navn: 'TESTSELSKAP AS' },
            ],
        })

        render(<ComparisonBar />)

        fireEvent.click(screen.getByRole('button', { name: 'Sammenlign' }))

        expect(mockNavigate).toHaveBeenCalledWith({
            to: '/sammenlign',
            search: { orgnr: '993144169,913352483' },
        })
    })

    it('removes and clears selected companies', () => {
        useComparisonStore.setState({
            companies: [
                { orgnr: '993144169', navn: 'VARDE HARTMARK AS' },
                { orgnr: '913352483', navn: 'TESTSELSKAP AS' },
            ],
        })

        render(<ComparisonBar />)

        fireEvent.click(screen.getByRole('button', { name: 'Fjern VARDE HARTMARK AS fra sammenligning' }))
        expect(useComparisonStore.getState().companies).toEqual([
            { orgnr: '913352483', navn: 'TESTSELSKAP AS' },
        ])

        fireEvent.click(screen.getByRole('button', { name: 'Nullstill' }))
        expect(useComparisonStore.getState().companies).toEqual([])
    })
})