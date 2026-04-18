import { useEffect, useMemo, useState } from 'react'
import { ArrowUpDown, Filter } from 'lucide-react'
import type { PersonRole } from '../../types/person'

type SortField = 'enhet_navn' | 'type_beskrivelse' | 'latest_salgsinntekter' | 'antall_ansatte'
type SortOrder = 'asc' | 'desc'
type StatusFilter = 'all' | 'active' | 'resigned'

interface PersonRoleFiltersProps {
    roles: PersonRole[]
    onFilteredRoles: (roles: PersonRole[]) => void
}

const SORT_OPTIONS: { value: SortField; label: string }[] = [
    { value: 'latest_salgsinntekter', label: 'Omsetning' },
    { value: 'antall_ansatte', label: 'Ansatte' },
    { value: 'enhet_navn', label: 'Selskapsnavn' },
    { value: 'type_beskrivelse', label: 'Rolletype' },
]

function sortRoles(roles: PersonRole[], field: SortField, order: SortOrder): PersonRole[] {
    return [...roles].sort((a, b) => {
        const av = a[field]
        const bv = b[field]
        if (av === null && bv === null) return 0
        if (av === null) return 1
        if (bv === null) return -1
        const cmp = typeof av === 'string' ? av.localeCompare(bv as string, 'nb') : (av as number) - (bv as number)
        return order === 'asc' ? cmp : -cmp
    })
}

export function PersonRoleFilters({ roles, onFilteredRoles }: PersonRoleFiltersProps) {
    const [sortField, setSortField] = useState<SortField>('latest_salgsinntekter')
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

    const orgForms = useMemo(() => {
        const forms = new Set<string>()
        roles.forEach((r) => { if (r.organisasjonsform) forms.add(r.organisasjonsform) })
        return Array.from(forms).sort()
    }, [roles])

    const [orgFormFilter, setOrgFormFilter] = useState<string>('all')

    useEffect(() => {
        let filtered = roles

        if (statusFilter === 'active') filtered = filtered.filter((r) => !r.fratraadt)
        else if (statusFilter === 'resigned') filtered = filtered.filter((r) => r.fratraadt)

        if (orgFormFilter !== 'all') filtered = filtered.filter((r) => r.organisasjonsform === orgFormFilter)

        const sorted = sortRoles(filtered, sortField, sortOrder)
        onFilteredRoles(sorted)
    }, [roles, sortField, sortOrder, statusFilter, orgFormFilter, onFilteredRoles])

    return (
        <div className="flex flex-wrap items-center gap-3 text-sm">
            {/* Sort control */}
            <div className="flex items-center gap-1.5">
                <ArrowUpDown className="h-4 w-4 text-gray-400" />
                <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as SortField)}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white"
                >
                    {SORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
                <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-2 py-1.5 text-gray-500 hover:text-blue-600 border border-gray-200 rounded-lg transition-colors"
                    title={sortOrder === 'asc' ? 'Stigende' : 'Synkende'}
                >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
            </div>

            {/* Status filter */}
            <div className="flex items-center gap-1.5">
                <Filter className="h-4 w-4 text-gray-400" />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white"
                >
                    <option value="all">Alle roller</option>
                    <option value="active">Aktive</option>
                    <option value="resigned">Fratrådt</option>
                </select>
            </div>

            {/* Org form filter */}
            {orgForms.length > 1 && (
                <select
                    value={orgFormFilter}
                    onChange={(e) => setOrgFormFilter(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white"
                >
                    <option value="all">Alle selskapsformer</option>
                    {orgForms.map((form) => (
                        <option key={form} value={form}>{form}</option>
                    ))}
                </select>
            )}
        </div>
    )
}
