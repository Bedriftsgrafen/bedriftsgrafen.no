import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MapFilterBar } from '../MapFilterBar'

describe('MapFilterBar', () => {
    const mockProps = {
        selectedNace: null,
        onNaceChange: vi.fn(),
        selectedCountyCode: null,
        onCountyChange: vi.fn(),
        selectedMunicipalityCode: null,
        onMunicipalityChange: vi.fn(),
        selectedOrgForms: [],
        onOrgFormsChange: vi.fn(),
        revenueMin: null,
        onRevenueChange: vi.fn(),
        employeeMin: null,
        onEmployeeChange: vi.fn(),
        onClear: vi.fn(),
    }

    it('renders all filter inputs', () => {
        render(<MapFilterBar {...mockProps} />)
        expect(screen.getByLabelText(/Bransje/i)).toBeDefined()
        expect(screen.getByLabelText(/Fylke/i)).toBeDefined()
        expect(screen.getByLabelText(/Kommune/i)).toBeDefined()
        expect(screen.getByLabelText(/Min. Omsetning/i)).toBeDefined()
        expect(screen.getByLabelText(/Min. Ansatte/i)).toBeDefined()
        expect(screen.getByLabelText(/Form/i)).toBeDefined()
    })

    it('calls onRevenueChange when revenue input changes', () => {
        render(<MapFilterBar {...mockProps} />)
        const input = screen.getByLabelText(/Min. Omsetning/i)
        fireEvent.change(input, { target: { value: '10' } })
        expect(mockProps.onRevenueChange).toHaveBeenCalledWith(10)
    })

    it('calls onEmployeeChange when employee input changes', () => {
        render(<MapFilterBar {...mockProps} />)
        const input = screen.getByLabelText(/Min. Ansatte/i)
        fireEvent.change(input, { target: { value: '5' } })
        expect(mockProps.onEmployeeChange).toHaveBeenCalledWith(5)
    })

    it('shows active filter count and clear button', () => {
        render(<MapFilterBar {...mockProps} revenueMin={10} />)
        // The clear button is only shown if activeFilterCount > 0
        // We can check if it exists by its title "Nullstill" (from my implementation)
        expect(screen.getByTitle('Nullstill')).toBeDefined()
    })

    it('calls onClear when clear button is clicked', () => {
        render(<MapFilterBar {...mockProps} revenueMin={10} />)
        const clearButton = screen.getByTitle('Nullstill')
        fireEvent.click(clearButton)
        expect(mockProps.onClear).toHaveBeenCalled()
    })
})
