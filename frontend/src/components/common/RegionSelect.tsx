/**
 * Reusable region select component with autocomplete/dropdown
 * For filtering by county or municipality
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, X, MapPin, Building } from 'lucide-react'
import { COUNTIES } from '../../constants/explorer'
import { ALL_NORWEGIAN_MUNICIPALITIES, formatMunicipalityName } from '../../constants/municipalities'

type RegionType = 'county' | 'municipality'

interface RegionSelectProps {
    type: RegionType
    value: string
    onChange: (value: string) => void
    placeholder?: string
    className?: string
}

interface SelectItem {
    code: string
    name: string
    subtitle?: string
    searchable: string
}

// Build county list from COUNTIES array
const COUNTY_LIST: SelectItem[] = COUNTIES.map(county => ({
    code: county.code,
    name: county.name,
    searchable: `${county.name} ${county.code}`.toLowerCase()
}))

// Build municipality list from complete list
const MUNICIPALITY_LIST: SelectItem[] = ALL_NORWEGIAN_MUNICIPALITIES.map(name => {
    const formattedName = formatMunicipalityName(name)
    return {
        code: name, // Use uppercase name as code (matches DB)
        name: formattedName,
        searchable: formattedName.toLowerCase()
    }
})

export const RegionSelect = React.memo(function RegionSelect({ type, value, onChange, placeholder, className = '' }: RegionSelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    const items = type === 'county' ? COUNTY_LIST : MUNICIPALITY_LIST

    // Filter items based on search
    const filteredItems = useMemo(() => {
        if (!search.trim()) return items.slice(0, 50) // Limit initial display
        const query = search.toLowerCase()
        return items.filter(item => item.searchable.includes(query)).slice(0, 50)
    }, [items, search])

    // Get display value
    const displayValue = useMemo(() => {
        if (!value) return ''
        if (type === 'county') {
            const county = COUNTIES.find(c => c.code === value)
            return county ? county.name : value
        }
        return value
    }, [type, value])

    // Handle click outside to close
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
                setSearch('')
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            return () => document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    const handleSelect = useCallback((code: string) => {
        onChange(code)
        setIsOpen(false)
        setSearch('')
    }, [onChange])

    const handleClear = useCallback((e: React.MouseEvent) => {
        e.stopPropagation()
        onChange('')
        setSearch('')
    }, [onChange])

    const handleInputClick = useCallback(() => {
        setIsOpen(true)
        setTimeout(() => inputRef.current?.focus(), 0)
    }, [])

    const Icon = type === 'county' ? Building : MapPin
    const defaultPlaceholder = type === 'county' ? 'Velg fylke...' : 'Velg kommune...'

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {/* Trigger button */}
            <button
                type="button"
                onClick={handleInputClick}
                className={`
                    flex items-center gap-2 px-3 py-1.5 text-sm 
                    border border-gray-300 rounded-lg bg-white
                    hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                    transition-colors min-w-[140px] text-left
                    ${value ? 'text-gray-900' : 'text-gray-500'}
                `}
            >
                <Icon className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="flex-1 truncate">
                    {displayValue || placeholder || defaultPlaceholder}
                </span>
                {value ? (
                    <X
                        className="w-4 h-4 text-gray-400 hover:text-gray-600 shrink-0"
                        onClick={handleClear}
                    />
                ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {/* Search input */}
                    <div className="p-2 border-b border-gray-100">
                        <input
                            ref={inputRef}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={`Søk etter ${type === 'county' ? 'fylke' : 'kommune'}...`}
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            autoComplete="off"
                        />
                    </div>

                    {/* Options list */}
                    <div className="max-h-48 overflow-y-auto">
                        {filteredItems.length === 0 ? (
                            <p className="text-sm text-gray-500 text-center py-4">
                                Ingen treff
                            </p>
                        ) : (
                            filteredItems.map((item) => (
                                <button
                                    key={item.code}
                                    type="button"
                                    onClick={() => handleSelect(item.code)}
                                    className={`
                                        w-full px-3 py-2 text-left text-sm
                                        hover:bg-blue-50 transition-colors
                                        flex items-center gap-2
                                        ${value === item.code ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}
                                    `}
                                >
                                    <Icon className="w-4 h-4 text-gray-400" />
                                    <div className="flex-1 min-w-0">
                                        <span className="block truncate">{item.name}</span>
                                        {item.subtitle && (
                                            <span className="block text-xs text-gray-400 truncate">{item.subtitle}</span>
                                        )}
                                    </div>
                                    {type === 'county' && (
                                        <span className="text-xs text-gray-400">{item.code}</span>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
})
