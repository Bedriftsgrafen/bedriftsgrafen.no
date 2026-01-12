import React, { useCallback, memo } from 'react'
import { Building2, MapPin, Briefcase, RotateCcw, Users, TrendingUp } from 'lucide-react'
import { useFilterStore } from '../../store/filterStore'
import { useExplorerStore } from '../../store/explorerStore'
import { RangeInput } from '../filter/RangeInput'
import { OrganizationFormFilter } from '../filter/OrganizationFormFilter'
import { NacePickerModal } from './modals/NacePickerModal'
import { RegionPickerModal } from './modals/RegionPickerModal'
import { ORGANIZATION_FORMS } from '../../constants/organizationForms'
import { COUNTIES } from '../../constants/explorer'
import { useNaceName } from '../../hooks/useNaceName'
import type { RangeFilterField } from '../../types/explorer'

/** Props for the FilterSection helper component */
interface FilterSectionProps {
    label: string
    icon?: React.ReactNode
    children: React.ReactNode
}

/** Helper component for filter sections - reduces repetition */
const FilterSection = memo(function FilterSection({
    label,
    icon,
    children,
}: FilterSectionProps) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-sm font-medium text-gray-700">{label}</span>
            </div>
            {children}
        </div>
    )
})

/**
 * Filter panel for the explorer page.
 * Manages NACE, region, organization form, and financial range filters.
 */
export const ExplorerFilters = memo(function ExplorerFilters() {
    // Shared filter state - using selectors for minimal re-renders
    const naeringskode = useFilterStore((s) => s.naeringskode)
    const municipality = useFilterStore((s) => s.municipality)
    const county = useFilterStore((s) => s.county)
    const organizationForms = useFilterStore((s) => s.organizationForms)
    const revenueMin = useFilterStore((s) => s.revenueMin)
    const revenueMax = useFilterStore((s) => s.revenueMax)
    const employeeMin = useFilterStore((s) => s.employeeMin)
    const employeeMax = useFilterStore((s) => s.employeeMax)
    const setNaeringskode = useFilterStore((s) => s.setNaeringskode)
    const setMunicipality = useFilterStore((s) => s.setMunicipality)
    const setCounty = useFilterStore((s) => s.setCounty)
    const setOrganizationForms = useFilterStore((s) => s.setOrganizationForms)
    const setRevenueRange = useFilterStore((s) => s.setRevenueRange)
    const setEmployeeRange = useFilterStore((s) => s.setEmployeeRange)
    const clearFilters = useFilterStore((s) => s.clearFilters)
    const getActiveFilterCount = useFilterStore((s) => s.getActiveFilterCount)

    // Get SSB NACE name for selected code
    const naceName = useNaceName(naeringskode)

    // Explorer-specific state
    const isNaceModalOpen = useExplorerStore((s) => s.isNaceModalOpen)
    const isRegionModalOpen = useExplorerStore((s) => s.isRegionModalOpen)
    const setNaceModalOpen = useExplorerStore((s) => s.setNaceModalOpen)
    const setRegionModalOpen = useExplorerStore((s) => s.setRegionModalOpen)

    const activeFilters = getActiveFilterCount()

    // Range change handler - memoized with proper dependencies
    const handleRangeChange = useCallback(
        (field: string, isMin: boolean, value: string, multiplier: number = 1) => {
            const numValue = value === '' ? null : parseFloat(value) * multiplier

            // Guard against NaN
            if (numValue !== null && !Number.isFinite(numValue)) {
                return
            }

            const rangeField = field as RangeFilterField

            switch (rangeField) {
                case 'revenue':
                    if (isMin) setRevenueRange(numValue, revenueMax)
                    else setRevenueRange(revenueMin, numValue)
                    break
                case 'employee':
                    if (isMin) setEmployeeRange(numValue, employeeMax)
                    else setEmployeeRange(employeeMin, numValue)
                    break
            }
        },
        [revenueMin, revenueMax, employeeMin, employeeMax, setRevenueRange, setEmployeeRange]
    )

    // Organization form toggle - memoized
    const handleOrganizationFormToggle = useCallback(
        (value: string) => {
            const newForms = organizationForms.includes(value)
                ? organizationForms.filter((f) => f !== value)
                : [...organizationForms, value]
            setOrganizationForms(newForms)
        },
        [organizationForms, setOrganizationForms]
    )

    // Modal handlers - stable references
    const openNaceModal = useCallback(() => setNaceModalOpen(true), [setNaceModalOpen])
    const closeNaceModal = useCallback(() => setNaceModalOpen(false), [setNaceModalOpen])
    const openRegionModal = useCallback(() => setRegionModalOpen(true), [setRegionModalOpen])
    const closeRegionModal = useCallback(() => setRegionModalOpen(false), [setRegionModalOpen])

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-gray-900">Filtre</h2>
                {activeFilters > 0 && (
                    <button
                        onClick={clearFilters}
                        type="button"
                        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                    >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        Nullstill ({activeFilters})
                    </button>
                )}
            </div>

            <div className="space-y-5">
                {/* NACE Picker */}
                <FilterSection label="Bransje (NACE)">
                    <button
                        onClick={openNaceModal}
                        type="button"
                        className="w-full flex items-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors text-left"
                    >
                        <Building2 className="h-5 w-5 text-gray-400 shrink-0" aria-hidden="true" />
                        {naeringskode ? (
                            <span className="text-gray-800 truncate">
                                <span className="font-medium">{naeringskode}</span>
                                <span className="text-gray-500 ml-1">- {naceName || 'Laster...'}</span>
                            </span>
                        ) : (
                            <span className="text-gray-500">Velg bransje...</span>
                        )}
                    </button>
                </FilterSection>

                {/* Region Picker */}
                <FilterSection label="Område">
                    <button
                        onClick={openRegionModal}
                        type="button"
                        className="w-full flex items-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-colors text-left"
                    >
                        <MapPin className="h-5 w-5 text-gray-400 shrink-0" aria-hidden="true" />
                        {county ? (
                            <span className="text-gray-800 font-medium truncate">
                                {COUNTIES.find(c => c.code === county)?.name || county} (fylke)
                            </span>
                        ) : municipality ? (
                            <span className="text-gray-800 font-medium truncate">{municipality}</span>
                        ) : (
                            <span className="text-gray-500">Velg område...</span>
                        )}
                    </button>
                </FilterSection>

                {/* Organization Form */}
                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                        <Briefcase className="h-4 w-4 text-gray-400" aria-hidden="true" />
                        Selskapsform
                    </label>
                    <OrganizationFormFilter
                        selectedForms={organizationForms}
                        options={ORGANIZATION_FORMS}
                        onToggle={handleOrganizationFormToggle}
                    />
                </div>

                <hr className="border-gray-200" />

                {/* Revenue Range */}
                <FilterSection label="Omsetning" icon={<TrendingUp className="h-4 w-4 text-gray-400" aria-hidden="true" />}>
                    <RangeInput
                        label=""
                        minValue={revenueMin}
                        maxValue={revenueMax}
                        onChange={handleRangeChange}
                        fieldName="revenue"
                        multiplier={1000000}
                        placeholder={{ min: 'Min (MNOK)', max: 'Maks (MNOK)' }}
                    />
                </FilterSection>

                {/* Employee Range */}
                <FilterSection label="Antall ansatte" icon={<Users className="h-4 w-4 text-gray-400" aria-hidden="true" />}>
                    <RangeInput
                        label=""
                        minValue={employeeMin}
                        maxValue={employeeMax}
                        onChange={handleRangeChange}
                        fieldName="employee"
                        placeholder={{ min: 'Min', max: 'Maks' }}
                    />
                </FilterSection>
            </div>

            {/* Modals - only render when open */}
            {isNaceModalOpen && (
                <NacePickerModal
                    isOpen={isNaceModalOpen}
                    onClose={closeNaceModal}
                    selectedCode={naeringskode}
                    onSelect={setNaeringskode}
                />
            )}

            {isRegionModalOpen && (
                <RegionPickerModal
                    isOpen={isRegionModalOpen}
                    onClose={closeRegionModal}
                    selectedMunicipality={municipality}
                    selectedCounty={county}
                    onSelectMunicipality={setMunicipality}
                    onSelectCounty={setCounty}
                />
            )}
        </div>
    )
})
