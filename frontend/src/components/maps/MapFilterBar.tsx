import { useMemo, useState, useEffect } from 'react';
import { RotateCcw, Filter, ChevronDown, ChevronUp, Landmark, Users, TrendingUp, Search } from 'lucide-react';
import { COUNTIES } from '../../constants/explorer';
import { MUNICIPALITIES } from '../../constants/municipalityCodes';
import { ORGANIZATION_FORMS } from '../../constants/organizationForms';
import { NacePicker } from './NacePicker';
import { MapFilterValues } from '../../types/map';
import { RangeInput } from '../filter/RangeInput';

interface MapFilterBarProps {
    filters: MapFilterValues;
    onChange: (updates: Partial<MapFilterValues>) => void;
    onClear: () => void;
    className?: string;
}

export function MapFilterBar({ filters, onChange, onClear, className }: MapFilterBarProps) {
    const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);
    const [localQuery, setLocalQuery] = useState(filters.query || '');

    // Sync localQuery when filters.query prop changes (debounced search)
    const [prevQuery, setPrevQuery] = useState(filters.query);
    if (filters.query !== prevQuery) {
        setPrevQuery(filters.query);
        setLocalQuery(filters.query || '');
    }

    // Debounce query changes
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localQuery !== (filters.query || '')) {
                onChange({ query: localQuery || null });
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [localQuery, onChange, filters.query]);

    // Filter municipalities based on selected county
    const filteredMunicipalities = useMemo(() => {
        if (!filters.countyCode) return [];
        return MUNICIPALITIES.filter(m => m.code.startsWith(filters.countyCode!))
            .sort((a, b) => a.name.localeCompare(b.name, 'nb'));
    }, [filters.countyCode]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (filters.naceCode) count++;
        if (filters.countyCode) count++;
        if (filters.municipalityCode) count++;
        if (filters.organizationForms.length > 0) count++;
        if (filters.revenueMin !== null || filters.revenueMax !== null) count++;
        if (filters.employeeMin !== null || filters.employeeMax !== null) count++;
        if (filters.profitMin !== null || filters.profitMax !== null) count++;
        if (filters.isBankrupt !== null) count++;
        if (filters.hasAccounting !== null) count++;
        if (filters.query) count++;
        return count;
    }, [filters]);

    const handleRangeChange = (field: string, isMin: boolean, value: string, multiplier: number = 1) => {
        const numValue = value === '' ? null : parseFloat(value) * multiplier;
        const finalField = `${field}${isMin ? 'Min' : 'Max'}` as keyof MapFilterValues;
        onChange({ [finalField]: numValue });
    };

    return (
        <div className={`bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-gray-100 p-5 mb-6 animate-in fade-in slide-in-from-top-4 duration-500 ${className || ''}`}>
            {/* Primary Filters Row */}
            <div className="flex flex-wrap items-end gap-x-4 gap-y-6">
                {/* Search Input */}
                <div className="flex-1 min-w-[240px]">
                    <label htmlFor="search-input" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                        Søk bedrifter
                    </label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            id="search-input"
                            type="text"
                            value={localQuery}
                            onChange={(e) => setLocalQuery(e.target.value)}
                            placeholder="Navn eller org.nr..."
                            className="block w-full pl-9 pr-4 py-2.5 bg-white/50 border border-gray-200 rounded-xl hover:border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm outline-none placeholder:text-gray-400"
                        />
                    </div>
                </div>
                {/* NACE Picker */}
                <div className="flex-1 min-w-[240px]">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                        Bransje
                    </label>
                    <NacePicker
                        value={filters.naceCode}
                        onChange={(val) => onChange({ naceCode: val })}
                    />
                </div>

                {/* County Filter */}
                <div className="w-full md:w-[180px]">
                    <label htmlFor="county-select" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                        Fylke
                    </label>
                    <select
                        id="county-select"
                        value={filters.countyCode || ''}
                        onChange={(e) => {
                            const code = e.target.value;
                            onChange({
                                countyCode: code || null,
                                municipalityCode: null // Reset municipality when county changes
                            });
                        }}
                        className="block w-full px-4 py-2.5 bg-white/50 border border-gray-200 rounded-xl hover:border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm outline-none"
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
                <div className="w-full md:w-[180px]">
                    <label htmlFor="municipality-select" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                        Kommune
                    </label>
                    <select
                        id="municipality-select"
                        value={filters.municipalityCode || ''}
                        onChange={(e) => onChange({ municipalityCode: e.target.value || null })}
                        disabled={!filters.countyCode}
                        className="block w-full px-4 py-2.5 bg-white/50 border border-gray-200 rounded-xl hover:border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm disabled:opacity-50 disabled:bg-gray-50 outline-none"
                    >
                        <option value="">Alle kommuner</option>
                        {filteredMunicipalities.map((m) => (
                            <option key={m.code} value={m.code}>
                                {m.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Organization Form */}
                <div className="w-full md:w-[150px]">
                    <label htmlFor="org-form-select" className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 ml-1">
                        Selskapsform
                    </label>
                    <select
                        id="org-form-select"
                        value={filters.organizationForms[0] || ''}
                        onChange={(e) => onChange({ organizationForms: e.target.value ? [e.target.value] : [] })}
                        className="block w-full px-4 py-2.5 bg-white/50 border border-gray-200 rounded-xl hover:border-gray-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm outline-none"
                    >
                        <option value="">Alle</option>
                        {ORGANIZATION_FORMS.map((f) => (
                            <option key={f.value} value={f.value}>
                                {f.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-sm font-medium ${isAdvancedOpen || activeFilterCount > (filters.naceCode ? 1 : 0) + (filters.countyCode ? 1 : 0) + (filters.municipalityCode ? 1 : 0) + (filters.organizationForms.length > 0 ? 1 : 0)
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        <Filter size={16} />
                        <span>Avansert</span>
                        {isAdvancedOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>

                    {activeFilterCount > 0 && (
                        <button
                            onClick={onClear}
                            className="p-2.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-gray-200 transition-all active:scale-[0.95]"
                            title="Nullstill alle filtre"
                        >
                            <RotateCcw size={20} />
                        </button>
                    )}
                </div>
            </div>

            {/* Advanced Filters Section */}
            {isAdvancedOpen && (
                <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-top-2 duration-300">
                    {/* Revenue Range */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                            <TrendingUp size={16} className="text-blue-500" />
                            <span>Omsetning (MNOK)</span>
                        </div>
                        <RangeInput
                            label=""
                            fieldName="revenue"
                            minValue={filters.revenueMin}
                            maxValue={filters.revenueMax}
                            onChange={handleRangeChange}
                            multiplier={1000000}
                        />
                    </div>

                    {/* Profit Range */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                            <Landmark size={16} className="text-emerald-500" />
                            <span>Årsresultat (MNOK)</span>
                        </div>
                        <RangeInput
                            label=""
                            fieldName="profit"
                            minValue={filters.profitMin}
                            maxValue={filters.profitMax}
                            onChange={handleRangeChange}
                            multiplier={1000000}
                        />
                    </div>

                    {/* Employee Range */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-gray-700 font-semibold text-sm">
                            <Users size={16} className="text-purple-500" />
                            <span>Ansatte</span>
                        </div>
                        <RangeInput
                            label=""
                            fieldName="employee"
                            minValue={filters.employeeMin}
                            maxValue={filters.employeeMax}
                            onChange={handleRangeChange}
                        />
                    </div>

                    {/* Status Switches */}
                    <div className="space-y-3">
                        <div className="text-gray-700 font-semibold text-sm">Selskapsstatus</div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => onChange({ isBankrupt: filters.isBankrupt === true ? null : true })}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filters.isBankrupt === true ? 'bg-red-100 text-red-700 border-red-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                                    } border`}
                            >
                                Konkurs
                            </button>
                            <button
                                onClick={() => onChange({ hasAccounting: filters.hasAccounting === true ? null : true })}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filters.hasAccounting === true ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                                    } border`}
                            >
                                Har regnskap
                            </button>
                            <button
                                onClick={() => onChange({ inLiquidation: filters.inLiquidation === true ? null : true })}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filters.inLiquidation === true ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                                    } border`}
                            >
                                Avvikling
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
