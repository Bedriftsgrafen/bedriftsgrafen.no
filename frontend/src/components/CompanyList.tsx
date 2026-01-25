import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Building2, Settings, RotateCcw, Gem, Calendar, History } from 'lucide-react'
import clsx from 'clsx'
import { Company } from '../types'
import { CompanyListSkeleton } from './skeletons/CompanyListSkeleton'
import { CompanyCard } from './CompanyCard'
import { EmptyState } from './EmptyState'
import { SortableHeader } from './common/SortableHeader'
import { Button } from './common/Button'
import { getOrganizationFormLabel } from '../utils/organizationForms'
import { useUiStore, COLUMN_CONFIG, type CompanyColumn } from '../store/uiStore'
import { useFilterStore } from '../store/filterStore'
import { formatDateNorwegian } from '../utils/dates'
import { formatCurrency, formatNumber, normalizeText } from '../utils/formatters'
import { formatNace } from '../utils/nace'

/** Compact badges for the list view */
const SmartBadgesList = ({ company }: { company: Company }) => {
    const badges = useMemo(() => {
        const list = []
        if (company.latest_equity_ratio && company.latest_equity_ratio >= 0.2) {
            list.push({ id: 'solid', icon: Gem, color: 'text-emerald-500', title: 'Solid' })
        }
        if (company.stiftelsesdato) {
            const stiftelse = new Date(company.stiftelsesdato)
            const oneYearAgo = new Date()
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
            if (stiftelse > oneYearAgo) {
                list.push({ id: 'new', icon: Calendar, color: 'text-blue-500', title: 'Ny' })
            }
            const twentyYearsAgo = new Date()
            twentyYearsAgo.setFullYear(twentyYearsAgo.getFullYear() - 20)
            if (stiftelse < twentyYearsAgo) {
                list.push({ id: 'veteran', icon: History, color: 'text-slate-500', title: 'Etablert' })
            }
        }
        return list
    }, [company.latest_equity_ratio, company.stiftelsesdato])

    if (badges.length === 0) return null

    return (
        <div className="flex items-center gap-1 mt-0.5">
            {badges.map(b => (
                <span key={b.id} title={b.title} className="flex items-center">
                    <b.icon className={clsx("h-3 w-3", b.color)} aria-hidden="true" />
                </span>
            ))}
        </div>
    )
}

// Extract rendering logic to pure functions
const renderMargin = (margin: number | null | undefined) => {
    if (margin == null) return <span className="text-gray-400">—</span>
    const colorClass = margin > 0 ? 'text-green-700' : margin < 0 ? 'text-red-700' : 'text-gray-600'
    return <span className={clsx("font-medium", colorClass)}>{margin.toFixed(1)}%</span>
}

const getCellValue = (company: Company, column: CompanyColumn): React.ReactNode => {
    switch (column) {
        case 'navn':
            return (
                <div className="flex flex-col">
                    <span className="truncate">{company.navn || 'Ukjent navn'}</span>
                    <SmartBadgesList company={company} />
                </div>
            )
        case 'orgnr': return company.orgnr
        case 'organisasjonsform':
            return <span title={getOrganizationFormLabel(company.organisasjonsform)}>{company.organisasjonsform}</span>
        case 'naeringskode':
            return (
                <div className="max-w-[200px] truncate" title={company.naeringskoder?.[0]
                    ? `${company.naeringskoder[0].kode} - ${company.naeringskoder[0].beskrivelse}`
                    : formatNace(company.naeringskode) || '-'}>
                    {company.naeringskoder?.[0]
                        ? `${company.naeringskoder[0].kode} - ${company.naeringskoder[0].beskrivelse}`
                        : formatNace(company.naeringskode) || '-'}
                </div>
            )
        case 'antall_ansatte': return company.antall_ansatte ?? '-'
        case 'stiftelsesdato': return formatDateNorwegian(company.stiftelsesdato || null)
        case 'kommune': return company.forretningsadresse?.kommune || company.postadresse?.kommune || '-'
        case 'revenue': return formatCurrency(company.latest_revenue)
        case 'profit': return formatCurrency(company.latest_profit)
        case 'operating_margin': return renderMargin(company.latest_operating_margin)
        case 'vedtektsfestet_formaal':
            return (
                <div className="max-w-md truncate" title={normalizeText(company.vedtektsfestet_formaal) || ''}>
                    {normalizeText(company.vedtektsfestet_formaal) || <span className="text-gray-400">—</span>}
                </div>
            )
        default: {
            // Exhaustiveness check - TypeScript will error if we miss a case
            void (column satisfies never)
            return '-'
        }
    }
}

// --- Sub-components ---

interface ColumnPickerProps {
    className?: string
}

const ColumnPicker: React.FC<ColumnPickerProps> = ({ className }) => {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const visibleColumns = useUiStore(s => s.visibleColumns)
    const toggleColumn = useUiStore(s => s.toggleColumn)
    const resetColumns = useUiStore(s => s.resetColumns)

    // Handle outside click
    useEffect(() => {
        if (!isOpen) return

        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    // Handle Escape & Focus management
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen) {
                setIsOpen(false)
                triggerRef.current?.focus() // RESTORE FOCUS
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [isOpen])

    return (
        <div className={clsx("relative", className)} ref={dropdownRef}>
            <button
                ref={triggerRef}
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    "p-2 rounded-xl transition-all duration-200 active:scale-90",
                    "text-slate-600 hover:text-blue-600 hover:bg-slate-100",
                    isOpen ? "bg-slate-100 text-blue-600 shadow-inner" : ""
                )}
                title="Velg kolonner"
                aria-label="Velg kolonner"
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                <Settings className="h-4 w-4" />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 backdrop-blur-md bg-white/80 rounded-xl shadow-xl border border-slate-200/50 py-2 z-50 min-w-[220px] animate-fade-in overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 uppercase">Kolonner</span>
                        <button
                            onClick={() => resetColumns()}
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 px-1 py-0.5 rounded hover:bg-blue-50 transition-colors"
                        >
                            <RotateCcw className="h-3 w-3" />
                            Nullstill
                        </button>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto py-1">
                        {(Object.entries(COLUMN_CONFIG) as [CompanyColumn, typeof COLUMN_CONFIG[CompanyColumn]][]).map(([key, config]) => (
                            <label
                                key={key}
                                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={visibleColumns.includes(key)}
                                    onChange={() => toggleColumn(key)}
                                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className={clsx("text-sm", visibleColumns.includes(key) ? "text-gray-900" : "text-gray-500")}>
                                    {config.label}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

// Memoized Body
interface CompanyTableBodyProps {
    companies: Company[]
    visibleColumns: CompanyColumn[]
    onSelectCompany: (orgnr: string) => void
    isLoading: boolean
    itemsPerPage: number
    clearFilters: () => void
}

const CompanyTableBody = React.memo(({
    companies,
    visibleColumns,
    onSelectCompany,
    isLoading,
    itemsPerPage,
    clearFilters
}: CompanyTableBodyProps) => {
    if (isLoading) {
        return <CompanyListSkeleton rows={itemsPerPage} cols={visibleColumns.length} />
    }

    if (companies.length === 0) {
        return (
            <tbody>
                <tr>
                    <td colSpan={visibleColumns.length} className="px-5 py-12">
                        <EmptyState
                            icon={Building2}
                            title="Ingen bedrifter funnet"
                            description="Prøv å justere filtrene eller søket ditt."
                            action={{
                                label: "Nullstill filtre",
                                onClick: clearFilters
                            }}
                        />
                    </td>
                </tr>
            </tbody>
        )
    }

    return (
        <tbody className="divide-y divide-gray-100 bg-white">
            {companies.map((company) => (
                <tr
                    key={company.orgnr}
                    onClick={() => onSelectCompany(company.orgnr)}
                    className="hover:bg-blue-50 transition-colors cursor-pointer group"
                >
                    {visibleColumns.map((column) => (
                        <td
                            key={column}
                            className={clsx(
                                "px-5 py-3 text-sm whitespace-nowrap",
                                column === 'navn' ? "font-medium text-gray-900" : "text-gray-500",
                                column === 'naeringskode' ? "text-xs" : "",
                                ['antall_ansatte', 'revenue', 'profit'].includes(column) ? "tabular-nums text-right" : ""
                            )}
                        >
                            {getCellValue(company, column)}
                        </td>
                    ))}
                </tr>
            ))}
        </tbody>
    )
})

interface CompanyListProps {
    companies: Company[]
    isLoading: boolean
    isError: boolean
    onSelectCompany: (orgnr: string) => void
    onRetry: () => void
    sortBy: string
    sortOrder: 'asc' | 'desc'
    onSortChange: (field: string) => void
    itemsPerPage: number
    totalCount?: number
    countLoading: boolean
    viewMode?: 'list' | 'cards'
}

export function CompanyList({
    companies,
    isLoading,
    isError,
    onSelectCompany,
    onRetry,
    sortBy,
    sortOrder,
    onSortChange,
    itemsPerPage,
    totalCount,
    countLoading,
    viewMode = 'list'
}: CompanyListProps) {
    const visibleColumns = useUiStore(s => s.visibleColumns)
    const reorderColumns = useUiStore(s => s.reorderColumns)
    const clearFilters = useFilterStore(s => s.clearFilters)

    // Drag state using refs to avoid nested setState anti-pattern
    // Refs are used instead of state because:
    // 1. We don't need re-renders during drag (visual feedback is CSS-based)
    // 2. handleDragEnd needs access to both values atomically
    const draggedColumnRef = useRef<number | null>(null)
    const dragOverColumnRef = useRef<number | null>(null)

    // Handlers - Stable References
    const handleDragStart = useCallback((index: number) => {
        draggedColumnRef.current = index
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
        e.preventDefault()
        dragOverColumnRef.current = index
    }, [])

    const handleDragEnd = useCallback(() => {
        const dragged = draggedColumnRef.current
        const over = dragOverColumnRef.current

        if (dragged !== null && over !== null && dragged !== over) {
            reorderColumns(dragged, over)
        }

        // Reset refs
        draggedColumnRef.current = null
        dragOverColumnRef.current = null
    }, [reorderColumns])

    if (isError) {
        return (
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 p-6 text-center">
                <p className="text-red-700 mb-3 font-medium">Kunne ikke laste bedrifter</p>
                <Button onClick={onRetry} variant="primary">Prøv igjen</Button>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-200 flex flex-col h-full">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-linear-to-br from-slate-50 to-white flex justify-between items-center shrink-0">
                <h2 className="font-semibold text-lg text-slate-900">Bedrifter</h2>
                <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600" aria-live="polite" aria-busy={countLoading}>
                        {countLoading ? (
                            <span className="flex items-center gap-2">
                                <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                                <span className="sr-only">Laster antall bedrifter</span>
                                Teller...
                            </span>
                        ) : (
                            formatNumber(totalCount ?? 0) + ' treff'
                        )}
                    </span>
                    <ColumnPicker />
                </div>
            </div>

            {/* Content */}
            {viewMode === 'cards' ? (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {isLoading ? (
                        Array.from({ length: itemsPerPage }).map((_, i) => (
                            <div key={i} className="bg-gray-100 rounded-lg h-44 animate-pulse" />
                        ))
                    ) : companies.length > 0 ? (
                        companies.map(c => <CompanyCard key={c.orgnr} company={c} onClick={() => onSelectCompany(c.orgnr)} />)
                    ) : (
                        <div className="col-span-full">
                            <EmptyState icon={Building2} title="Ingen treff" description="Ingen bedrifter funnet." />
                        </div>
                    )}
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50/50 text-slate-600 font-medium">
                            <tr>
                                {visibleColumns.map((column, index) => (
                                    <SortableHeader
                                        key={column}
                                        field={column}
                                        label={COLUMN_CONFIG[column].label}
                                        currentSort={sortBy}
                                        sortOrder={sortOrder}
                                        onSort={() => onSortChange(column)}
                                        sortable={COLUMN_CONFIG[column].sortable}
                                        className="px-5 py-3 transition-colors select-none"
                                        draggable
                                        onDragStart={() => handleDragStart(index)}
                                        onDragOver={(e) => handleDragOver(e, index)}
                                        onDragEnd={handleDragEnd}
                                    />
                                ))}
                            </tr>
                        </thead>
                        <CompanyTableBody
                            companies={companies}
                            visibleColumns={visibleColumns}
                            onSelectCompany={onSelectCompany}
                            isLoading={isLoading}
                            itemsPerPage={itemsPerPage}
                            clearFilters={clearFilters}
                        />
                    </table>
                </div>
            )}
        </div>
    )
}

