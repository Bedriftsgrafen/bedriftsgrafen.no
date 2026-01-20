import React from 'react'
import { X, Search } from 'lucide-react'
import { OrganizationFormFilter } from './OrganizationFormFilter'
import { ORGANIZATION_FORMS } from '../../constants/organizationForms'
import { FilterValues } from '../../store/filterStore'

interface BasisFiltersProps {
    draftFilters: FilterValues
    setDraftFilters: React.Dispatch<React.SetStateAction<FilterValues>>
    searchInputRef: React.RefObject<HTMLInputElement | null>
    applyFilters: () => void
}

export function BasisFilters({
    draftFilters,
    setDraftFilters,
    searchInputRef,
    applyFilters
}: BasisFiltersProps) {
    const handleOrganizationFormToggle = (value: string) => {
        setDraftFilters((prev) => ({
            ...prev,
            organizationForms: prev.organizationForms.includes(value)
                ? prev.organizationForms.filter((f) => f !== value)
                : [...prev.organizationForms, value]
        }))
    }

    return (
        <section className="space-y-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Basis
            </h3>

            {/* Sorting */}
            <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">Sortering</label>
                <div className="grid grid-cols-5 gap-2">
                    <select
                        value={draftFilters.sortBy}
                        onChange={(e) => setDraftFilters((prev) => ({ ...prev, sortBy: e.target.value }))}
                        className="col-span-3 px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm bg-white transition-all"
                    >
                        <option value="navn">Navn</option>
                        <option value="antall_ansatte">Antall ansatte</option>
                        <option value="revenue">Omsetning</option>
                        <option value="profit">Årsresultat</option>
                        <option value="operating_profit">Driftsresultat</option>
                        <option value="stiftelsesdato">Stiftelsesdato</option>
                    </select>
                    <select
                        value={draftFilters.sortOrder}
                        onChange={(e) => setDraftFilters((prev) => ({ ...prev, sortOrder: e.target.value as 'asc' | 'desc' }))}
                        className="col-span-2 px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm bg-white transition-all"
                    >
                        <option value="asc">Stigende</option>
                        <option value="desc">Synkende</option>
                    </select>
                </div>
            </div>

            {/* Search */}
            <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">
                    Søk <span className="text-[10px] text-slate-400 font-normal ml-1 tracking-normal">('/')</span>
                </label>
                <div className="relative group">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                        <Search className="h-4 w-4" />
                    </div>
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Søk navn eller org.nr..."
                        value={draftFilters.searchQuery}
                        onChange={(e) => setDraftFilters((prev) => ({ ...prev, searchQuery: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                        className="w-full pl-10 pr-10 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    />
                    {draftFilters.searchQuery && (
                        <button
                            onClick={() => setDraftFilters((prev) => ({ ...prev, searchQuery: '' }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                            aria-label="Tøm søkefelt"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

            <OrganizationFormFilter
                selectedForms={draftFilters.organizationForms}
                options={ORGANIZATION_FORMS}
                onToggle={handleOrganizationFormToggle}
                onSelectAll={() => setDraftFilters((prev) => ({ ...prev, organizationForms: ORGANIZATION_FORMS.map(f => f.value) }))}
                onClearAll={() => setDraftFilters((prev) => ({ ...prev, organizationForms: [] }))}
            />

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Næringskode</label>
                    <input
                        type="text"
                        placeholder="F.eks. 62.100"
                        value={draftFilters.naeringskode}
                        onChange={(e) => setDraftFilters((prev) => ({ ...prev, naeringskode: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all"
                    />
                </div>

                <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Kommune/Område</label>
                    <input
                        type="text"
                        placeholder="F.eks. Oslo"
                        value={draftFilters.municipality}
                        onChange={(e) => setDraftFilters((prev) => ({ ...prev, municipality: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-sm transition-all"
                    />
                </div>
            </div>
        </section>
    )
}
