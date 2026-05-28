import { Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, Building2, ChevronRight, ExternalLink, ListTree, Loader2, Search } from 'lucide-react'
import { memo, useCallback, useMemo, useState } from 'react'
import { NACE_SECTIONS } from '../../constants/naceSections'
import { API_BASE } from '../../utils/apiClient'
import { formatNumber } from '../../utils/formatters'
import { createRouteCode } from '../../utils/slugify'

interface NaceHierarchyRow {
    code: string
    parent: string
    level: number
    name: string
}

interface DivisionStatSummary {
    nace_division: string
    company_count: number
    total_employees: number | null
}

interface NaceHierarchyBrowserProps {
    initialNace?: string
    divisionStats: DivisionStatSummary[]
}

const DEFAULT_OPEN_SECTIONS = new Set(['A', 'F', 'G', 'J', 'M'])

function normalizeText(value: string) {
    return value.toLowerCase().trim()
}

function getSearchHaystack(row: NaceHierarchyRow) {
    return `${row.code} ${row.name}`.toLowerCase()
}

function buildChildrenByParent(rows: NaceHierarchyRow[]) {
    const childrenByParent = new Map<string, NaceHierarchyRow[]>()

    for (const row of rows) {
        const siblings = childrenByParent.get(row.parent) ?? []
        siblings.push(row)
        childrenByParent.set(row.parent, siblings)
    }

    for (const children of childrenByParent.values()) {
        children.sort((a, b) => a.code.localeCompare(b.code, 'nb-NO', { numeric: true }))
    }

    return childrenByParent
}

function getInitialSection(rows: NaceHierarchyRow[], initialNace?: string) {
    if (!initialNace) return null
    const exactRow = rows.find((row) => row.code === initialNace)
    if (exactRow?.level === 2) return exactRow.parent
    if (exactRow) return rows.find((row) => row.code === exactRow.code.slice(0, 2))?.parent ?? null

    const division = initialNace.slice(0, 2)
    return rows.find((row) => row.code === division)?.parent ?? null
}

const NaceTreeNode = memo(function NaceTreeNode({
    node,
    childrenByParent,
    divisionStatsByCode,
}: {
    node: NaceHierarchyRow
    childrenByParent: Map<string, NaceHierarchyRow[]>
    divisionStatsByCode: Map<string, DivisionStatSummary>
}) {
    const children = childrenByParent.get(node.code) ?? []
    const [isOpen, setIsOpen] = useState(node.level < 3)
    const divisionStat = node.level === 2 ? divisionStatsByCode.get(node.code) : undefined
    const isDivision = node.level === 2

    return (
        <li className="border-l border-slate-200 pl-3 dark:border-slate-700">
            <div className="flex flex-col gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/70 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-2">
                    {children.length > 0 ? (
                        <button
                            type="button"
                            onClick={() => setIsOpen((value) => !value)}
                            aria-label={`${isOpen ? 'Skjul' : 'Vis'} undernivåer for ${node.code} ${node.name}`}
                            aria-expanded={isOpen}
                            className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-400/30 dark:hover:bg-blue-400/10 dark:hover:text-blue-200"
                        >
                            <ChevronRight className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`} aria-hidden="true" />
                        </button>
                    ) : (
                        <span className="mt-0.5 h-7 w-7 shrink-0" aria-hidden="true" />
                    )}
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-lg bg-blue-50 px-2 py-1 font-mono text-xs font-semibold text-blue-700 dark:bg-blue-400/10 dark:text-blue-200">
                                {node.code}
                            </span>
                            {divisionStat && (
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                    {formatNumber(divisionStat.company_count)} virksomheter
                                </span>
                            )}
                        </div>
                        <p className="mt-1 text-sm font-semibold leading-6 text-slate-900 dark:text-white">{node.name}</p>
                    </div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 pl-9 sm:pl-0">
                    {isDivision && (
                        <Link
                            to="/bransje/$code"
                            params={{ code: createRouteCode(node.code, node.name) }}
                            aria-label={`Åpne bransjeside for NACE ${node.code} ${node.name}`}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400/30 dark:hover:bg-blue-400/10 dark:hover:text-blue-200"
                        >
                            Bransjeside
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                    )}
                    <Link
                        to="/bransjer"
                        search={{ tab: 'search', nace: node.code }}
                        aria-label={`Vis virksomheter med NACE ${node.code} ${node.name}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 dark:bg-blue-600 dark:hover:bg-blue-500"
                    >
                        Virksomheter
                    </Link>
                </div>
            </div>

            {children.length > 0 && isOpen && (
                <ul className="ml-3 space-y-1 pb-1 pt-1 sm:ml-6">
                    {children.map((child) => (
                        <NaceTreeNode
                            key={child.code}
                            node={child}
                            childrenByParent={childrenByParent}
                            divisionStatsByCode={divisionStatsByCode}
                        />
                    ))}
                </ul>
            )}
        </li>
    )
})

function NaceSearchResults({ rows }: { rows: NaceHierarchyRow[] }) {
    return (
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-700 dark:bg-slate-950/60">
            {rows.map((row) => {
                const isDivision = row.level === 2
                return (
                    <div key={row.code} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="rounded-lg bg-blue-50 px-2 py-1 font-mono text-xs font-semibold text-blue-700 dark:bg-blue-400/10 dark:text-blue-200">
                                    {row.code}
                                </span>
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Nivå {row.level}</span>
                            </div>
                            <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{row.name}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                            {isDivision && (
                                <Link
                                    to="/bransje/$code"
                                    params={{ code: createRouteCode(row.code, row.name) }}
                                    aria-label={`Åpne bransjeside for NACE ${row.code} ${row.name}`}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400/30 dark:hover:bg-blue-400/10 dark:hover:text-blue-200"
                                >
                                    Bransjeside
                                </Link>
                            )}
                            <Link
                                to="/bransjer"
                                search={{ tab: 'search', nace: row.code }}
                                aria-label={`Vis virksomheter med NACE ${row.code} ${row.name}`}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-900 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 dark:bg-blue-600 dark:hover:bg-blue-500"
                            >
                                Virksomheter
                            </Link>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

export function NaceHierarchyBrowser({ initialNace, divisionStats }: NaceHierarchyBrowserProps) {
    const [searchQuery, setSearchQuery] = useState('')
    const [sectionOverrides, setSectionOverrides] = useState<Record<string, boolean>>({})

    const { data: hierarchy = [], isLoading, isError } = useQuery<NaceHierarchyRow[]>({
        queryKey: ['naceHierarchy'],
        queryFn: async () => {
            const response = await fetch(`${API_BASE}/v1/companies/nace/hierarchy`)
            if (!response.ok) throw new Error('Failed to fetch NACE hierarchy')
            return response.json()
        },
        staleTime: 1000 * 60 * 60 * 24,
        retry: 2,
    })

    const childrenByParent = useMemo(() => buildChildrenByParent(hierarchy), [hierarchy])

    const sectionCodes = useMemo(
        () => Array.from(new Set(hierarchy.filter((row) => row.level === 2).map((row) => row.parent))).sort(),
        [hierarchy],
    )

    const divisionStatsByCode = useMemo(
        () => new Map(divisionStats.map((stat) => [stat.nace_division, stat])),
        [divisionStats],
    )

    const activeInitialSection = useMemo(() => getInitialSection(hierarchy, initialNace), [hierarchy, initialNace])

    const filteredRows = useMemo(() => {
        const query = normalizeText(searchQuery)
        if (!query) return []
        return hierarchy.filter((row) => getSearchHaystack(row).includes(query)).slice(0, 80)
    }, [hierarchy, searchQuery])

    const isSectionOpen = useCallback((sectionCode: string) => {
        const override = sectionOverrides[sectionCode]
        if (override !== undefined) return override
        return DEFAULT_OPEN_SECTIONS.has(sectionCode) || activeInitialSection === sectionCode
    }, [activeInitialSection, sectionOverrides])

    const toggleSection = useCallback((sectionCode: string) => {
        setSectionOverrides((current) => ({
            ...current,
            [sectionCode]: !isSectionOpen(sectionCode),
        }))
    }, [isSectionOpen])

    if (isLoading) {
        return (
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex items-center justify-center gap-3 py-8 text-slate-600 dark:text-slate-300">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-hidden="true" />
                    <span>Laster næringskodeverket...</span>
                </div>
            </section>
        )
    }

    if (isError) {
        return null
    }

    return (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
            <div className="border-b border-slate-200 p-4 dark:border-slate-800 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-semibold uppercase text-blue-700 dark:text-blue-300">
                            <ListTree className="h-4 w-4" aria-hidden="true" />
                            Næringskodeverk
                        </div>
                        <h2 className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">Drill ned i NACE-koder</h2>
                        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                            Utforsk SSBs hierarki fra seksjon til undernivå. Gå til bransjesider for 2-sifrede koder, eller åpne virksomhetssøk for mer presise koder.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Filtrer kode eller navn"
                                aria-label="Filtrer næringskodeverket"
                                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-300 dark:focus:ring-blue-300/30 sm:w-72"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setSectionOverrides(Object.fromEntries(sectionCodes.map((sectionCode) => [sectionCode, true])))}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400/30 dark:hover:bg-blue-400/10 dark:hover:text-blue-200"
                            >
                                Åpne alle
                            </button>
                            <button
                                type="button"
                                onClick={() => setSectionOverrides(Object.fromEntries(sectionCodes.map((sectionCode) => [sectionCode, false])))}
                                className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 dark:border-slate-700 dark:text-slate-200 dark:hover:border-blue-400/30 dark:hover:bg-blue-400/10 dark:hover:text-blue-200"
                            >
                                Lukk alle
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-4 sm:p-5">
                {searchQuery.trim() ? (
                    filteredRows.length > 0 ? (
                        <NaceSearchResults rows={filteredRows} />
                    ) : (
                        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            Ingen næringskoder funnet for «{searchQuery}».
                        </p>
                    )
                ) : (
                    <div className="space-y-3">
                        {sectionCodes.map((sectionCode) => {
                            const sectionRows = childrenByParent.get(sectionCode) ?? []
                            const sectionCompanyCount = sectionRows.reduce(
                                (sum, row) => sum + (divisionStatsByCode.get(row.code)?.company_count ?? 0),
                                0,
                            )
                            const isOpen = isSectionOpen(sectionCode)

                            return (
                                <section key={sectionCode} className="rounded-xl border border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/50">
                                    <button
                                        type="button"
                                        onClick={() => toggleSection(sectionCode)}
                                        aria-expanded={isOpen}
                                        className="flex w-full items-center justify-between gap-4 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-200"
                                    >
                                        <span className="flex min-w-0 items-start gap-3">
                                            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-900 font-mono text-sm font-semibold text-white dark:bg-blue-600">
                                                {sectionCode}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block text-base font-semibold text-slate-950 dark:text-white">
                                                    {NACE_SECTIONS[sectionCode] ?? `Seksjon ${sectionCode}`}
                                                </span>
                                                <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                                    <span className="inline-flex items-center gap-1">
                                                        <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                                                        {sectionRows.length} hovedgrupper
                                                    </span>
                                                    <span className="inline-flex items-center gap-1">
                                                        <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
                                                        {formatNumber(sectionCompanyCount)} virksomheter
                                                    </span>
                                                </span>
                                            </span>
                                        </span>
                                        <ChevronRight className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} aria-hidden="true" />
                                    </button>

                                    {isOpen && (
                                        <div className="border-t border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/50">
                                            <ul className="space-y-1">
                                                {sectionRows.map((row) => (
                                                    <NaceTreeNode
                                                        key={row.code}
                                                        node={row}
                                                        childrenByParent={childrenByParent}
                                                        divisionStatsByCode={divisionStatsByCode}
                                                    />
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </section>
                            )
                        })}
                    </div>
                )}
            </div>
        </section>
    )
}