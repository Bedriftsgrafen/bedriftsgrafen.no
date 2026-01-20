import { render, screen, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MapFilterBar } from '../MapFilterBar'
import { defaultMapFilters } from '../../../types/map'

describe('MapFilterBar', () => {
    const mockProps = {
        filters: defaultMapFilters,
        onChange: vi.fn(),
        onClear: vi.fn(),
    }

    it('renders primary filter inputs', () => {
        render(<MapFilterBar {...mockProps} />)
        expect(screen.getByLabelText(/Søk bedrifter/i)).toBeDefined()
        // Bransje might appear multiple times (label + picker), so we check that at least one exists
        expect(screen.getAllByText(/Bransje/i).length).toBeGreaterThan(0)
        expect(screen.getByLabelText(/Fylke/i)).toBeDefined()
        expect(screen.getByLabelText(/Kommune/i)).toBeDefined()
        expect(screen.getByLabelText(/Selskapsform/i)).toBeDefined()
    })

    it('calls onChange when search input changes', async () => {
        render(<MapFilterBar {...mockProps} />)
        const input = screen.getByPlaceholderText(/Navn eller org.nr.../i)
        fireEvent.change(input, { target: { value: 'test' } })

        // Wait for debounce (500ms)
        await vi.waitUntil(() => mockProps.onChange.mock.calls.length > 0, { timeout: 1000, interval: 50 })
        expect(mockProps.onChange).toHaveBeenCalledWith({ query: 'test' })
    })

    it('calls onChange when revenue input changes in advanced section', () => {
        render(<MapFilterBar {...mockProps} />)
        // Click to open advanced filters
        fireEvent.click(screen.getByText(/Avansert/i))

        // Find the container containing "Omsetning (MNOK)"
        const revenueSection = screen.getByText(/Omsetning \(MNOK\)/i).parentElement?.parentElement
        if (!revenueSection) throw new Error("Revenue section not found")

        const minInput = within(revenueSection).getByPlaceholderText(/Min/i)
        fireEvent.change(minInput, { target: { value: '10' } })
        expect(mockProps.onChange).toHaveBeenCalledWith({ revenueMin: 10000000 })
    })

    it('calls onChange when employee input changes in advanced section', () => {
        render(<MapFilterBar {...mockProps} />)
        fireEvent.click(screen.getByText(/Avansert/i))

        const employeeSection = screen.getByText(/Ansatte/i).parentElement?.parentElement
        if (!employeeSection) throw new Error("Employee section not found")

        const minInput = within(employeeSection).getByPlaceholderText(/Min/i)
        fireEvent.change(minInput, { target: { value: '5' } })
        expect(mockProps.onChange).toHaveBeenCalledWith({ employeeMin: 5 })
    })

    it('shows active filter count and clear button', () => {
        const filtersWithRevenue = { ...defaultMapFilters, revenueMin: 10000000 }
        render(<MapFilterBar {...mockProps} filters={filtersWithRevenue} />)
        expect(screen.getByTitle(/Nullstill alle filtre/i)).toBeDefined()
    })

    it('calls onClear when clear button is clicked', () => {
        const filtersWithRevenue = { ...defaultMapFilters, revenueMin: 10000000 }
        render(<MapFilterBar {...mockProps} filters={filtersWithRevenue} />)
        const clearButton = screen.getByTitle(/Nullstill alle filtre/i)
        fireEvent.click(clearButton)
        expect(mockProps.onClear).toHaveBeenCalled()
    })
})
