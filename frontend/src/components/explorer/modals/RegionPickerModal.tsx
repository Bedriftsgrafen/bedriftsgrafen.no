import React, { useState, useMemo, useCallback, memo } from 'react'
import { Check, Search, MapPin, Building } from 'lucide-react'
import { PickerModalBase } from '../PickerModalBase'
import { COUNTIES } from '../../../constants/explorer'
import { ALL_NORWEGIAN_MUNICIPALITIES, formatMunicipalityName } from '../../../constants/municipalities'

/** Picker mode - county or municipality */
type PickerMode = 'county' | 'municipality'

/** Municipality entry with formatted name */
interface MunicipalityEntry {
    name: string       // Formatted name (Title Case)
    searchable: string // Lowercase for search
}

/** Props for RegionPickerModal */
export interface RegionPickerModalProps {
    isOpen: boolean
    onClose: () => void
    selectedMunicipality: string
    selectedCounty: string
    onSelectMunicipality: (municipality: string) => void
    onSelectCounty: (county: string) => void
}

/** Props for SearchInput */
interface SearchInputProps {
    value: string
    onChange: (value: string) => void
    placeholder: string
    ariaLabel: string
}

/** Search input component - memoized to prevent re-renders */
const SearchInput = memo(function SearchInput({
    value,
    onChange,
    placeholder,
    ariaLabel,
}: SearchInputProps) {
    const handleChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
        [onChange]
    )

    return (
        <div className="relative">
            <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                aria-hidden="true"
            />
            <input
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={handleChange}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                autoFocus
                aria-label={ariaLabel}
            />
        </div>
    )
})

/** Mode toggle buttons */
const ModeToggle = memo(function ModeToggle({
    mode,
    onModeChange,
}: {
    mode: PickerMode
    onModeChange: (mode: PickerMode) => void
}) {
    return (
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-3">
            <button
                type="button"
                onClick={() => onModeChange('county')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'county'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
            >
                <Building className="h-4 w-4" aria-hidden="true" />
                Fylke
            </button>
            <button
                type="button"
                onClick={() => onModeChange('municipality')}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'municipality'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
            >
                <MapPin className="h-4 w-4" aria-hidden="true" />
                Kommune
            </button>
        </div>
    )
})

/** Single county or municipality item - memoized for list performance */
const LocationItem = memo(function LocationItem({
    name,
    subtitle,
    isSelected,
    onSelect,
    icon: Icon,
}: {
    name: string
    subtitle?: string
    isSelected: boolean
    onSelect: (name: string) => void
    icon: typeof MapPin | typeof Building
}) {
    const handleClick = useCallback(() => onSelect(name), [name, onSelect])

    return (
        <button
            onClick={handleClick}
            type="button"
            role="option"
            aria-selected={isSelected}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${isSelected
                ? 'bg-blue-50 border border-blue-200'
                : 'hover:bg-gray-50 border border-transparent'
                }`}
        >
            <span
                className={`flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
                    }`}
                aria-hidden="true"
            >
                <Icon className="h-4 w-4" />
            </span>
            <div className="flex-1 min-w-0">
                <span className="text-gray-800 font-medium">{name}</span>
                {subtitle && (
                    <span className="text-gray-400 text-sm ml-2">{subtitle}</span>
                )}
            </div>
            {isSelected && (
                <Check className="h-5 w-5 text-blue-600 flex-shrink-0" aria-hidden="true" />
            )}
        </button>
    )
})

// Pre-compute municipality entries for performance (computed once at module load)
const MUNICIPALITY_ENTRIES: readonly MunicipalityEntry[] = Object.freeze(
    ALL_NORWEGIAN_MUNICIPALITIES.map(name => ({
        name: formatMunicipalityName(name),
        searchable: name.toLowerCase()
    }))
)

/**
 * Internal modal content - separated to allow key-based remounting
 */
const RegionPickerModalContent = memo(function RegionPickerModalContent({
    onClose,
    selectedMunicipality,
    selectedCounty,
    onSelectMunicipality,
    onSelectCounty,
}: Omit<RegionPickerModalProps, 'isOpen'>) {
    // Determine initial mode based on what's already selected
    const initialMode: PickerMode = selectedCounty ? 'county' : 'municipality'

    const [mode, setMode] = useState<PickerMode>(initialMode)
    const [search, setSearch] = useState('')
    const [tempCounty, setTempCounty] = useState(selectedCounty)
    const [tempMunicipality, setTempMunicipality] = useState(selectedMunicipality)

    // Filter based on search
    const filteredCounties = useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) return COUNTIES
        return COUNTIES.filter((c) => c.name.toLowerCase().includes(query))
    }, [search])

    const filteredMunicipalities = useMemo(() => {
        const query = search.trim().toLowerCase()
        // Show first 100 when no search to avoid overwhelming the UI
        if (!query) return MUNICIPALITY_ENTRIES.slice(0, 100)
        return MUNICIPALITY_ENTRIES.filter(m => m.searchable.includes(query)).slice(0, 100)
    }, [search])

    // Handlers
    const handleConfirm = useCallback(() => {
        if (mode === 'county') {
            onSelectCounty(tempCounty)
            onSelectMunicipality('') // Clear municipality when county is set
        } else {
            onSelectMunicipality(tempMunicipality)
            onSelectCounty('') // Clear county when municipality is set
        }
        onClose()
    }, [mode, tempCounty, tempMunicipality, onSelectCounty, onSelectMunicipality, onClose])

    const handleClear = useCallback(() => {
        onSelectMunicipality('')
        onSelectCounty('')
        onClose()
    }, [onSelectMunicipality, onSelectCounty, onClose])

    const handleModeChange = useCallback((newMode: PickerMode) => {
        setMode(newMode)
        setSearch('')
    }, [])

    return (
        <PickerModalBase
            isOpen={true}
            onClose={onClose}
            title="Velg område"
            titleId="region-modal-title"
            onConfirm={handleConfirm}
            onClear={handleClear}
            searchContent={
                <div>
                    <ModeToggle mode={mode} onModeChange={handleModeChange} />
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder={mode === 'county' ? 'Søk etter fylke...' : 'Søk etter kommune eller fylke...'}
                        ariaLabel={mode === 'county' ? 'Søk etter fylke' : 'Søk etter kommune'}
                    />
                </div>
            }
        >
            <div role="listbox" aria-label={mode === 'county' ? 'Fylker' : 'Kommuner'}>
                {mode === 'county' ? (
                    // County list
                    filteredCounties.length === 0 ? (
                        <p className="text-center text-gray-500 py-8" role="status">
                            Ingen fylker funnet
                        </p>
                    ) : (
                        <div className="space-y-1">
                            {filteredCounties.map((county) => (
                                <LocationItem
                                    key={county.code}
                                    name={county.name}
                                    isSelected={tempCounty === county.name}
                                    onSelect={setTempCounty}
                                    icon={Building}
                                />
                            ))}
                        </div>
                    )
                ) : (
                    // Municipality list
                    filteredMunicipalities.length === 0 ? (
                        <p className="text-center text-gray-500 py-8" role="status">
                            Ingen kommuner funnet
                        </p>
                    ) : (
                        <div className="space-y-1">
                            {filteredMunicipalities.map((m) => (
                                <LocationItem
                                    key={m.name}
                                    name={m.name}
                                    isSelected={tempMunicipality === m.name}
                                    onSelect={setTempMunicipality}
                                    icon={MapPin}
                                />
                            ))}
                        </div>
                    )
                )}
            </div>
        </PickerModalBase>
    )
})

/**
 * Modal for selecting Norwegian counties or municipalities.
 * Uses key-based remounting to reset state when modal opens.
 */
export const RegionPickerModal = memo(function RegionPickerModal({
    isOpen,
    onClose,
    selectedMunicipality,
    selectedCounty,
    onSelectMunicipality,
    onSelectCounty,
}: RegionPickerModalProps) {
    // Early return for performance
    if (!isOpen) return null

    return (
        <RegionPickerModalContent
            key={`region-modal-${selectedMunicipality}-${selectedCounty}`}
            onClose={onClose}
            selectedMunicipality={selectedMunicipality}
            selectedCounty={selectedCounty}
            onSelectMunicipality={onSelectMunicipality}
            onSelectCounty={onSelectCounty}
        />
    )
})
