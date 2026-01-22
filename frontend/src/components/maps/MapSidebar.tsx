import React, { useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { ChevronRight, Filter, RotateCcw, Map as MapIcon } from 'lucide-react';
import clsx from 'clsx';
import { Legend } from './parts/Legend';
import { AveragesBox } from './parts/AveragesBox';
import { GeoLevel, GeoAverages } from './parts/types';
import { formatNumber } from '../../utils/formatters';
import { MapFilterValues } from '../../types/map';

// Segments
import { GeoControls } from './segments/GeoControls';
import { SearchControls } from './segments/SearchControls';
import { FinancialControls } from './segments/FinancialControls';
import { StatusControls } from './segments/StatusControls';

interface MapSidebarProps {
    // Current state (Stats)
    level: GeoLevel;
    setLevel: (level: GeoLevel) => void;
    selectedRegionData: {
        name: string;
        code: string;
        value: number;
        perCapita?: number;
        population?: number;
    } | null;
    hoveredRegion: { name: string; value: number } | null;
    maxValue: number;
    metricLabel: string;
    averages?: GeoAverages;
    onCloseRegion?: () => void;
    onShowCompanies?: (name: string, code: string) => void;

    // Filter state
    filters: MapFilterValues;
    onFilterChange: (updates: Partial<MapFilterValues>) => void;
    onClearFilters: () => void;

    className?: string;
}

export const MapSidebar: React.FC<MapSidebarProps> = ({
    level,
    setLevel,
    selectedRegionData,
    hoveredRegion,
    maxValue,
    metricLabel,
    averages,
    onCloseRegion,
    onShowCompanies,
    filters,
    onFilterChange,
    onClearFilters,
    className
}) => {
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

    return (
        <div className={clsx(
            "w-full md:w-85 bg-slate-50 border-t md:border-t-0 md:border-r border-slate-200 flex flex-col h-[500px] md:h-full overflow-hidden shrink-0 shadow-inner",
            className
        )}>
            {/* Sidebar Header */}
            <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-blue-600" />
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Kartfilter</h2>
                    {activeFilterCount > 0 && (
                        <span className="bg-blue-100 text-blue-700 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                            {activeFilterCount}
                        </span>
                    )}
                </div>
                {activeFilterCount > 0 && (
                    <button
                        onClick={onClearFilters}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all"
                        title="Nullstill alle filtre"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-4 space-y-6 pt-6 pb-20">
                {/* Region Details (Primary when selected) */}
                {selectedRegionData && (
                    <section className="px-4">
                        <div className="bg-white rounded-xl border border-blue-100 p-4 shadow-sm animate-in fade-in slide-in-from-top-2">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h4 className="text-base font-black text-slate-900 leading-tight">{selectedRegionData.name}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                        {level === 'county' ? 'Fylke' : 'Kommune'}
                                    </p>
                                </div>
                                <button
                                    onClick={onCloseRegion}
                                    className="p-1 hover:bg-slate-100 rounded-md text-slate-300 transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-3 mb-4">
                                <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">{metricLabel}</p>
                                    <p className="text-xl font-black text-slate-900 tabular-nums">
                                        {filters.hasAccounting ? (
                                            formatNumber(selectedRegionData.value)
                                        ) : (
                                            filters.isBankrupt ? formatNumber(selectedRegionData.value) : formatNumber(selectedRegionData.value)
                                        )}
                                        {filters.query && <span className="text-[10px] text-slate-400 ml-1 block mt-0.5 font-bold uppercase tracking-tighter">* for søket "{filters.query}"</span>}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <button
                                    onClick={() => onShowCompanies?.(selectedRegionData.name, selectedRegionData.code)}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-xs font-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                                >
                                    Se bedrifter
                                    <ChevronRight className="w-4 h-4" />
                                </button>

                                {level === 'municipality' && (
                                    <Link
                                        to="/kommune/$code"
                                        params={{ code: `${selectedRegionData.code}-${selectedRegionData.name.toLowerCase().replace(' ', '-')}` }}
                                        className="w-full bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                                    >
                                        Åpne Dashboard
                                        <ChevronRight className="w-3 h-3" />
                                    </Link>
                                )}
                            </div>
                        </div>
                    </section>
                )}

                {!selectedRegionData && (
                    <section className="px-4">
                        <div className="py-6 text-center bg-white rounded-xl border border-dashed border-slate-200">
                            <MapIcon className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                Velg en region i kartet<br />for å se detaljer
                            </p>
                        </div>
                    </section>
                )}

                <div className="px-4 space-y-8">
                    {/* Filter Segments */}
                    <GeoControls
                        level={level}
                        setLevel={setLevel}
                        countyCode={filters.countyCode}
                        setCountyCode={(code) => onFilterChange({ countyCode: code })}
                        municipalityCode={filters.municipalityCode}
                        setMunicipalityCode={(code) => onFilterChange({ municipalityCode: code })}
                        showPerCapita={filters.showPerCapita}
                        setShowPerCapita={(val) => onFilterChange({ showPerCapita: val })}
                    />

                    <hr className="border-slate-100" />

                    <SearchControls
                        query={filters.query}
                        setQuery={(q) => onFilterChange({ query: q })}
                        naceCode={filters.naceCode}
                        setNaceCode={(code) => onFilterChange({ naceCode: code })}
                    />

                    <hr className="border-slate-100" />

                    <FinancialControls
                        filters={filters}
                        onChange={onFilterChange}
                    />

                    <hr className="border-slate-100" />

                    <StatusControls
                        isBankrupt={filters.isBankrupt}
                        setIsBankrupt={(val) => onFilterChange({ isBankrupt: val })}
                        hasAccounting={filters.hasAccounting}
                        setHasAccounting={(val) => onFilterChange({ hasAccounting: val })}
                        inLiquidation={filters.inLiquidation}
                        setInLiquidation={(val) => onFilterChange({ inLiquidation: val })}
                    />

                    <hr className="border-slate-100" />

                    {/* Legend & Stats */}
                    <section className="space-y-6 pt-2">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Varmekart</h3>
                        <Legend maxValue={maxValue} metricLabel={metricLabel} isVertical />

                        {averages && (
                            <div className="mt-4">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Landsgjennomsnitt</h3>
                                <AveragesBox
                                    averages={averages}
                                    level={level}
                                    currentValue={hoveredRegion || undefined}
                                    isSidebar
                                />
                                <p className="text-[10px] text-slate-400 mt-2 italic px-1 leading-relaxed">
                                    * Gjennomsnitt beregnes basert på dine aktive filtre (bransje, økonomi osv).
                                </p>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};
