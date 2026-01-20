import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BasisFilters } from '../BasisFilters'
import { FinancialFilters } from '../FinancialFilters'
import { StatusAndDateFilters } from '../StatusAndDateFilters'
import { FilterValues } from '../../../store/filterStore'

const mockFilterValues: FilterValues = {
    searchQuery: '',
    organizationForms: [],
    naeringskode: '',
    revenueMin: null,
    revenueMax: null,
    profitMin: null,
    profitMax: null,
    equityMin: null,
    equityMax: null,
    operatingProfitMin: null,
    operatingProfitMax: null,
    liquidityRatioMin: null,
    liquidityRatioMax: null,
    equityRatioMin: null,
    equityRatioMax: null,
    employeeMin: null,
    employeeMax: null,
    municipality: '',
    municipalityCode: '',
    county: '',
    countyCode: '',
    foundedFrom: null,
    foundedTo: null,
    bankruptFrom: null,
    bankruptTo: null,
    isBankrupt: null,
    inLiquidation: null,
    inForcedLiquidation: null,
    hasAccounting: null,
    sortBy: 'navn',
    sortOrder: 'asc'
}

describe('Filter Sub-components', () => {
    describe('BasisFilters', () => {
        it('renders search input and triggers change', () => {
            const setDraftFilters = vi.fn()
            const applyFilters = vi.fn()

            render(
                <BasisFilters
                    draftFilters={mockFilterValues}
                    setDraftFilters={setDraftFilters}
                    searchInputRef={{ current: null }}
                    applyFilters={applyFilters}
                />
            )

            const input = screen.getByPlaceholderText(/Søk navn eller org.nr/i)
            fireEvent.change(input, { target: { value: 'Test' } })

            expect(setDraftFilters).toHaveBeenCalled()
        })
    })

    describe('FinancialFilters', () => {
        it('renders financial range inputs', () => {
            const handleRangeChange = vi.fn()
            const handleHasAccountingChange = vi.fn()

            render(
                <FinancialFilters
                    draftFilters={mockFilterValues}
                    handleRangeChange={handleRangeChange}
                    handleHasAccountingChange={handleHasAccountingChange}
                />
            )

            expect(screen.getByText(/Omsetning \(mill. kr\)/i)).toBeDefined()
        })
    })

    describe('StatusAndDateFilters', () => {
        it('renders status checkboxes', () => {
            const handleRangeChange = vi.fn()
            const handleDateChange = vi.fn()
            const handleBankruptDateChange = vi.fn()
            const handleStatusChange = vi.fn()

            render(
                <StatusAndDateFilters
                    draftFilters={mockFilterValues}
                    handleRangeChange={handleRangeChange}
                    handleDateChange={handleDateChange}
                    handleBankruptDateChange={handleBankruptDateChange}
                    handleStatusChange={handleStatusChange}
                />
            )

            expect(screen.getByText(/Status/i)).toBeDefined()
        })
    })
})
