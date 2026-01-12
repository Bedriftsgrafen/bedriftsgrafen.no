/**
 * Unit tests for comparisonStore.
 *
 * Tests company comparison state management.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useComparisonStore } from '../comparisonStore'

// Mock toast to prevent side effects
vi.mock('../toastStore', () => ({
    toast: {
        success: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
    },
}))

// Reset store before each test
beforeEach(() => {
    useComparisonStore.setState({
        companies: [],
        isModalOpen: false,
    })
})

describe('ComparisonStore Initial State', () => {
    it('should start with empty comparison list', () => {
        const state = useComparisonStore.getState()
        expect(state.companies).toEqual([])
    })

    it('should start with modal closed', () => {
        const state = useComparisonStore.getState()
        expect(state.isModalOpen).toBe(false)
    })
})

describe('Add Company', () => {
    it('addCompany should add company to list', () => {
        useComparisonStore.getState().addCompany({ orgnr: '123456789', navn: 'Test AS' })

        const companies = useComparisonStore.getState().companies
        expect(companies).toHaveLength(1)
        expect(companies[0].orgnr).toBe('123456789')
    })

    it('addCompany should not add duplicates', () => {
        useComparisonStore.getState().addCompany({ orgnr: '123', navn: 'Test' })
        useComparisonStore.getState().addCompany({ orgnr: '123', navn: 'Test' })

        expect(useComparisonStore.getState().companies).toHaveLength(1)
    })

    it('addCompany should limit to max 3 items', () => {
        useComparisonStore.getState().addCompany({ orgnr: '111', navn: 'A' })
        useComparisonStore.getState().addCompany({ orgnr: '222', navn: 'B' })
        useComparisonStore.getState().addCompany({ orgnr: '333', navn: 'C' })
        useComparisonStore.getState().addCompany({ orgnr: '444', navn: 'D' })

        expect(useComparisonStore.getState().companies).toHaveLength(3)
    })
})

describe('Remove Company', () => {
    it('removeCompany should remove specific company', () => {
        useComparisonStore.getState().addCompany({ orgnr: '111', navn: 'First' })
        useComparisonStore.getState().addCompany({ orgnr: '222', navn: 'Second' })
        useComparisonStore.getState().removeCompany('111')

        const companies = useComparisonStore.getState().companies
        expect(companies).toHaveLength(1)
        expect(companies[0].orgnr).toBe('222')
    })
})

describe('Clear Comparison', () => {
    it('clear should empty the list', () => {
        useComparisonStore.getState().addCompany({ orgnr: '111', navn: 'A' })
        useComparisonStore.getState().addCompany({ orgnr: '222', navn: 'B' })
        useComparisonStore.getState().clear()

        expect(useComparisonStore.getState().companies).toEqual([])
    })
})

describe('IsSelected Check', () => {
    it('isSelected should return true for added company', () => {
        useComparisonStore.getState().addCompany({ orgnr: '123', navn: 'Test' })

        expect(useComparisonStore.getState().isSelected('123')).toBe(true)
    })

    it('isSelected should return false for non-added company', () => {
        expect(useComparisonStore.getState().isSelected('999')).toBe(false)
    })
})

describe('Modal Controls', () => {
    it('openModal should set isModalOpen to true', () => {
        useComparisonStore.getState().openModal()

        expect(useComparisonStore.getState().isModalOpen).toBe(true)
    })

    it('closeModal should set isModalOpen to false', () => {
        useComparisonStore.setState({ isModalOpen: true })
        useComparisonStore.getState().closeModal()

        expect(useComparisonStore.getState().isModalOpen).toBe(false)
    })
})
