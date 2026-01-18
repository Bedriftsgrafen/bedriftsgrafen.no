import { useMemo } from 'react'
import { RotateCcw } from 'lucide-react'
import { COUNTIES, NACE_CODES, NACE_DIVISIONS } from '../../constants/explorer'
import { MUNICIPALITIES } from '../../constants/municipalityCodes'
import { ORGANIZATION_FORMS } from '../../constants/organizationForms'

interface MapFilterBarProps {
    selectedNace: string | null
    onNaceChange: (nace: string | null) => void

    selectedCountyCode: string | null
    onCountyChange: (name: string, code: string) => void

    selectedMunicipalityCode: string | null
    onMunicipalityChange: (name: string, code: string) => void

    selectedOrgForms: string[]
    onOrgFormsChange: (forms: string[]) => void

    revenueMin: number | null
    onRevenueChange: (value: number | null) => void

    employeeMin: number | null
    onEmployeeChange: (value: number | null) => void

    onClear: () => void
}

export function MapFilterBar({
    selectedNace,
    onNaceChange,
    selectedCountyCode,
    onCountyChange,
    selectedMunicipalityCode,
    onMunicipalityChange,
    selectedOrgForms,
    onOrgFormsChange,
    revenueMin,
    onRevenueChange,
    employeeMin,
    onEmployeeChange,
    onClear
}: MapFilterBarProps) {
    // Flatten NACE divisions for dropdown
    const allNaceDivisions = useMemo(() => {
        const divisions: { code: string; name: string }[] = []
        for (const section of NACE_CODES) {
            const sectionDivisions = NACE_DIVISIONS[section.code] || []
            for (const div of sectionDivisions) {
                divisions.push({ code: div.code, name: div.name })
            }
        }
        return divisions.sort((a, b) => parseInt(a.code) - parseInt(b.code))
    }, [])

    // Filter municipalities based on selected county
    const filteredMunicipalities = useMemo(() => {
        if (!selectedCountyCode) return []
        // Municipality code starts with county code (first 2 digits)
        return MUNICIPALITIES.filter(m => m.code.startsWith(selectedCountyCode))
            .sort((a, b) => a.name.localeCompare(b.name, 'nb'))
    }, [selectedCountyCode])

    const activeFilterCount = useMemo(() => {
        let count = 0
        if (selectedNace) count++
        if (selectedCountyCode) count++
        if (selectedMunicipalityCode) count++
        if (selectedOrgForms.length > 0) count++
        if (revenueMin !== null) count++
        if (employeeMin !== null) count++
        return count
    }, [selectedNace, selectedCountyCode, selectedMunicipalityCode, selectedOrgForms, revenueMin, employeeMin])

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 items-end gap-x-4 gap-y-6">
                {/* NACE Filter */}
                <div className="lg:col-span-1">
                    <label htmlFor="nace-filter" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Bransje
                    </label>
                    <select
                        id="nace-filter"
                        value={selectedNace || ''}
                        onChange={(e) => onNaceChange(e.target.value || null)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    >
                        <option value="">Alle bransjer</option>
                        {allNaceDivisions.map((div) => (
                            <option key={div.code} value={div.code}>
                                {div.code} - {div.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* County Filter */}
                <div>
                    <label htmlFor="county-filter" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Fylke
                    </label>
                    <select
                        id="county-filter"
                        value={selectedCountyCode || ''}
                        onChange={(e) => {
                            const code = e.target.value
                            const name = COUNTIES.find(c => c.code === code)?.name || ''
                            onCountyChange(name, code)
                        }}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    >
                        <option value="">Hele landet</option>
                        {COUNTIES.map((c) => (
                            <option key={c.code} value={c.code}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Municipality Filter */}
                <div>
                    <label htmlFor="municipality-filter" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Kommune
                    </label>
                    <select
                        id="municipality-filter"
                        value={selectedMunicipalityCode || ''}
                        onChange={(e) => {
                            const code = e.target.value
                            const name = MUNICIPALITIES.find(m => m.code === code)?.name || ''
                            onMunicipalityChange(name, code)
                        }}
                        disabled={!selectedCountyCode}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                    >
                        <option value="">Alle kommuner</option>
                        {filteredMunicipalities.map((m) => (
                            <option key={m.code} value={m.code}>
                                {m.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Revenue Filter */}
                <div>
                    <label htmlFor="revenue-filter" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Min. Omsetning (MNOK)
                    </label>
                    <input
                        id="revenue-filter"
                        type="number"
                        min="0"
                        placeholder="Eks: 10"
                        value={revenueMin ?? ''}
                        onChange={(e) => onRevenueChange(e.target.value ? parseFloat(e.target.value) : null)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                </div>

                {/* Employee Filter */}
                <div>
                    <label htmlFor="employee-filter" className="block text-sm font-medium text-gray-700 mb-1.5">
                        Min. Ansatte
                    </label>
                    <input
                        id="employee-filter"
                        type="number"
                        min="0"
                        placeholder="Eks: 5"
                        value={employeeMin ?? ''}
                        onChange={(e) => onEmployeeChange(e.target.value ? parseInt(e.target.value) : null)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                    />
                </div>

                {/* Actions group */}
                <div className="flex items-center gap-2">
                    <div className="flex-1">
                        <label htmlFor="org-form-filter" className="block text-sm font-medium text-gray-700 mb-1.5">
                            Form
                        </label>
                        <select
                            id="org-form-filter"
                            value={selectedOrgForms[0] || ''}
                            onChange={(e) => onOrgFormsChange(e.target.value ? [e.target.value] : [])}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                        >
                            <option value="">Alle</option>
                            {ORGANIZATION_FORMS.map((f) => (
                                <option key={f.value} value={f.value}>
                                    {f.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Reset Button */}
                    {activeFilterCount > 0 && (
                        <button
                            onClick={onClear}
                            type="button"
                            className="mt-6 p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md border border-gray-200 transition-colors"
                            title="Nullstill"
                        >
                            <RotateCcw className="h-5 w-5" aria-hidden="true" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
