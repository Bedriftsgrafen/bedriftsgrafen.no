import React, { useState, useMemo, useCallback, memo, useEffect } from 'react'
import { Check, Search, ChevronRight, ChevronDown, Loader2 } from 'lucide-react'
import { PickerModalBase } from '../PickerModalBase'
import { NACE_CODES, NACE_DIVISIONS } from '../../../constants/explorer'
import type { NacePickerModalProps, NaceCode } from '../../../types/explorer'
import { apiClient } from '../../../utils/apiClient'
import { useSlowLoadingToast } from '../../../hooks/useSlowLoadingToast'

/** SSB NACE code from hierarchy API */
interface SsbNaceCode {
    code: string
    parent: string
    level: number
    name: string
}

/** Subclass from API with company count */
interface NaceSubclass {
    code: string
    name: string
    count: number
}

/** Cache for SSB NACE hierarchy */
let ssbHierarchyCache: Record<string, SsbNaceCode> = {}
let ssbHierarchyLoaded = false

/** Search input component */
const SearchInput = memo(function SearchInput({
    value,
    onChange,
    placeholder,
}: {
    value: string
    onChange: (value: string) => void
    placeholder: string
}) {
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
                onChange={(e) => onChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                autoFocus
            />
        </div>
    )
})

/** Get SSB name for a code */
function getSsbName(code: string): string | null {
    return ssbHierarchyCache[code]?.name || null
}

/** Expandable NACE item */
interface NaceNodeProps {
    code: string
    name: string
    level: number
    count?: number
    isExpanded: boolean
    isSelected: boolean
    onToggle: (code: string) => void
    onSelect: (code: string) => void
    children?: React.ReactNode
    hasChildren: boolean
    isLoading?: boolean
}

const NaceNode = memo(function NaceNode({
    code,
    name,
    level,
    count,
    isExpanded,
    isSelected,
    onToggle,
    onSelect,
    children,
    hasChildren,
    isLoading,
}: NaceNodeProps) {
    // Better indentation: 24px base + 20px per level
    const indent = level * 24

    return (
        <div>
            <div
                className="flex items-center gap-1 py-0.5"
                style={{ paddingLeft: `${indent}px` }}
            >
                {/* Expand/collapse button */}
                <button
                    type="button"
                    onClick={() => hasChildren && onToggle(code)}
                    className={`flex items-center justify-center h-6 w-6 rounded flex-shrink-0 ${hasChildren ? 'hover:bg-gray-200 cursor-pointer' : ''
                        }`}
                    disabled={!hasChildren}
                >
                    {isLoading ? (
                        <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                    ) : hasChildren ? (
                        isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                        ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                        )
                    ) : (
                        <span className="w-4" />
                    )}
                </button>

                {/* Select button */}
                <button
                    type="button"
                    onClick={() => onSelect(code)}
                    className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors min-w-0 ${isSelected
                        ? 'bg-blue-50 border border-blue-300'
                        : 'hover:bg-gray-50 border border-transparent'
                        }`}
                >
                    <span
                        className={`flex items-center justify-center px-1.5 py-0.5 rounded font-mono text-xs flex-shrink-0 ${isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-600'
                            }`}
                    >
                        {code}
                    </span>
                    <span className="flex-1 text-sm text-gray-700 truncate">{name}</span>
                    {count !== undefined && (
                        <span className="text-xs text-gray-400 flex-shrink-0">
                            ({count.toLocaleString('nb-NO')})
                        </span>
                    )}
                    {isSelected && (
                        <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    )}
                </button>
            </div>

            {/* Children */}
            {isExpanded && children}
        </div>
    )
})

/**
 * NacePickerModal content with full SSB hierarchy
 */
const NacePickerModalContent = memo(function NacePickerModalContent({
    onClose,
    selectedCode,
    onSelect,
}: Omit<NacePickerModalProps, 'isOpen'>) {
    const [search, setSearch] = useState('')
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
    const [subclassCache, setSubclassCache] = useState<Record<string, NaceSubclass[]>>({})
    const [loadingPrefix, setLoadingPrefix] = useState<string | null>(null)
    const [tempSelection, setTempSelection] = useState<string>(selectedCode || '')
    const [hierarchyLoaded, setHierarchyLoaded] = useState(ssbHierarchyLoaded)

    // Load SSB hierarchy on mount
    useEffect(() => {
        if (ssbHierarchyLoaded) return

        apiClient.get<SsbNaceCode[]>('/v1/companies/nace/hierarchy')
            .then(res => {
                for (const code of res.data) {
                    ssbHierarchyCache[code.code] = code
                }
                ssbHierarchyLoaded = true
                setHierarchyLoaded(true)
            })
            .catch(err => console.error('Failed to load NACE hierarchy:', err))
    }, [])

    // Build searchable list of all codes (sections + divisions + SSB codes)
    const allSearchableCodes = useMemo(() => {
        const codes: Array<{ code: string; name: string; level: number }> = []

        // Add sections (A-U)
        for (const section of NACE_CODES) {
            codes.push({ code: section.code, name: section.name, level: 1 })
        }

        // Add divisions from static data
        for (const [_sectionCode, divisions] of Object.entries(NACE_DIVISIONS)) {
            for (const div of divisions) {
                codes.push({ code: div.code, name: div.name, level: 2 })
            }
        }

        // Add SSB codes
        for (const [code, ssbCode] of Object.entries(ssbHierarchyCache)) {
            if (!codes.some(c => c.code === code)) {
                codes.push({ code, name: ssbCode.name, level: ssbCode.level })
            }
        }

        return codes
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hierarchyLoaded])

    // Filter based on search - search all levels
    const searchResults = useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) return null

        return allSearchableCodes
            .filter(c =>
                c.code.toLowerCase().includes(query) ||
                c.name.toLowerCase().includes(query)
            )
            .slice(0, 50) // Limit results
    }, [search, allSearchableCodes])

    // Fetch subclasses for a division
    const fetchSubclasses = useCallback(async (prefix: string) => {
        if (subclassCache[prefix]) return

        setLoadingPrefix(prefix)
        try {
            const response = await apiClient.get<NaceSubclass[]>(`/v1/companies/nace/${prefix}/subclasses`)
            setSubclassCache(prev => ({ ...prev, [prefix]: response.data }))
        } catch (err) {
            console.error('Failed to fetch NACE subclasses:', err)
            setSubclassCache(prev => ({ ...prev, [prefix]: [] }))
        } finally {
            setLoadingPrefix(null)
        }
    }, [subclassCache])

    // Slow loading feedback
    useSlowLoadingToast(!!loadingPrefix, 'Henter underkategorier...')

    // Toggle expand/collapse
    const handleToggle = useCallback((code: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev)
            if (next.has(code)) {
                next.delete(code)
            } else {
                next.add(code)
                // If it's a division code (2 digits), fetch subclasses
                if (/^\d{2}$/.test(code)) {
                    fetchSubclasses(code)
                }
            }
            return next
        })
    }, [fetchSubclasses])

    // Select a code
    const handleSelect = useCallback((code: string) => {
        setTempSelection(code)
    }, [])

    // Confirm selection
    const handleConfirm = useCallback(() => {
        onSelect(tempSelection || '')
        onClose()
    }, [tempSelection, onSelect, onClose])

    // Clear selection
    const handleClear = useCallback(() => {
        setTempSelection('')
        setExpandedNodes(new Set())
    }, [])

    // Render search results
    const renderSearchResults = () => {
        if (!searchResults) return null

        return (
            <div className="space-y-1 py-2">
                {searchResults.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">Ingen treff</p>
                ) : (
                    searchResults.map(result => (
                        <NaceNode
                            key={result.code}
                            code={result.code}
                            name={result.name}
                            level={0}
                            isExpanded={false}
                            isSelected={tempSelection === result.code}
                            onToggle={() => { }}
                            onSelect={handleSelect}
                            hasChildren={false}
                        />
                    ))
                )}
            </div>
        )
    }

    // Render a section (A, B, C, ...)
    const renderSection = (section: NaceCode) => {
        const divisions = NACE_DIVISIONS[section.code] || []
        const isExpanded = expandedNodes.has(section.code)
        const isSelected = tempSelection === section.code

        return (
            <NaceNode
                key={section.code}
                code={section.code}
                name={section.name}
                level={0}
                isExpanded={isExpanded}
                isSelected={isSelected}
                onToggle={handleToggle}
                onSelect={handleSelect}
                hasChildren={divisions.length > 0}
            >
                {divisions.map(div => renderDivision(div))}
            </NaceNode>
        )
    }

    // Render a division (01, 02, ...)
    const renderDivision = (div: { code: string; name: string }) => {
        const isExpanded = expandedNodes.has(div.code)
        const isSelected = tempSelection === div.code
        const subclasses = subclassCache[div.code] || []
        const isLoading = loadingPrefix === div.code

        // Group subclasses by first 4 characters (e.g., 01.1, 01.2)
        const groupMap = new Map<string, NaceSubclass[]>()
        for (const sc of subclasses) {
            const groupCode = sc.code.substring(0, 4)
            const existing = groupMap.get(groupCode) || []
            groupMap.set(groupCode, [...existing, sc])
        }

        return (
            <NaceNode
                key={div.code}
                code={div.code}
                name={div.name}
                level={1}
                isExpanded={isExpanded}
                isSelected={isSelected}
                onToggle={handleToggle}
                onSelect={handleSelect}
                hasChildren={true}
                isLoading={isLoading}
            >
                {Array.from(groupMap.entries()).map(([groupCode, classes]) =>
                    renderGroup(groupCode, classes)
                )}
            </NaceNode>
        )
    }

    // Render a group (01.1, 01.2, ...)
    const renderGroup = (groupCode: string, classes: NaceSubclass[]) => {
        const isExpanded = expandedNodes.has(groupCode)
        const isSelected = tempSelection === groupCode
        const totalCount = classes.reduce((sum, c) => sum + c.count, 0)
        // Get SSB name for the group, fallback to first class name
        const groupName = getSsbName(groupCode) || classes[0]?.name || `Gruppe ${groupCode}`

        return (
            <NaceNode
                key={groupCode}
                code={groupCode}
                name={groupName}
                level={2}
                count={totalCount}
                isExpanded={isExpanded}
                isSelected={isSelected}
                onToggle={() => {
                    setExpandedNodes(prev => {
                        const next = new Set(prev)
                        if (next.has(groupCode)) {
                            next.delete(groupCode)
                        } else {
                            next.add(groupCode)
                        }
                        return next
                    })
                }}
                onSelect={handleSelect}
                hasChildren={classes.length > 1}
            >
                {classes.map(cls => renderClass(cls))}
            </NaceNode>
        )
    }

    // Render a class (01.110, 01.120, ...)
    const renderClass = (cls: NaceSubclass) => {
        const isSelected = tempSelection === cls.code

        return (
            <NaceNode
                key={cls.code}
                code={cls.code}
                name={cls.name}
                level={3}
                count={cls.count}
                isExpanded={false}
                isSelected={isSelected}
                onToggle={() => { }}
                onSelect={handleSelect}
                hasChildren={false}
            />
        )
    }

    return (
        <PickerModalBase
            isOpen={true}
            onClose={onClose}
            title="Velg bransje"
            titleId="nace-picker-title"
            onConfirm={handleConfirm}
            onClear={handleClear}
            confirmDisabled={!tempSelection}
            searchContent={
                <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Søk etter bransje eller kode..."
                />
            }
        >
            <div className="space-y-0.5 py-2">
                {searchResults ? (
                    renderSearchResults()
                ) : (
                    NACE_CODES.map(section => renderSection(section))
                )}
            </div>
        </PickerModalBase>
    )
})

/**
 * NACE code picker modal with SSB hierarchy
 */
export function NacePickerModal({
    isOpen,
    onClose,
    selectedCode,
    onSelect,
}: NacePickerModalProps) {
    if (!isOpen) return null

    return (
        <NacePickerModalContent
            key={selectedCode || 'empty'}
            onClose={onClose}
            selectedCode={selectedCode}
            onSelect={onSelect}
        />
    )
}
