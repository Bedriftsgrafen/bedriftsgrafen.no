import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RegionPickerModal } from '../modals/RegionPickerModal'

describe('RegionPickerModal', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'scrollTo', {
            value: vi.fn(),
            writable: true,
        })
    })

    it('exposes the county-municipality toggle as a named group', () => {
        render(
            <RegionPickerModal
                isOpen
                onClose={() => {}}
                selectedMunicipality=""
                selectedMunicipalityCode=""
                selectedCounty=""
                selectedCountyCode=""
                onSelectMunicipality={() => {}}
                onSelectCounty={() => {}}
            />
        )

        expect(screen.getByRole('group', { name: 'Velg områdenivå' })).toBeInTheDocument()
    })

    it('updates pressed state when switching between municipality and county', () => {
        render(
            <RegionPickerModal
                isOpen
                onClose={() => {}}
                selectedMunicipality=""
                selectedMunicipalityCode=""
                selectedCounty=""
                selectedCountyCode=""
                onSelectMunicipality={() => {}}
                onSelectCounty={() => {}}
            />
        )

        const countyButton = screen.getByRole('button', { name: 'Fylke' })
        const municipalityButton = screen.getByRole('button', { name: 'Kommune' })

        expect(countyButton).toHaveAttribute('aria-pressed', 'false')
        expect(municipalityButton).toHaveAttribute('aria-pressed', 'true')

        fireEvent.click(countyButton)

        expect(countyButton).toHaveAttribute('aria-pressed', 'true')
        expect(municipalityButton).toHaveAttribute('aria-pressed', 'false')
    })
})