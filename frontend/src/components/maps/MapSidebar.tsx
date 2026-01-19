import React from 'react';
import { Users, Layout, Map as MapIcon, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import { Legend } from './parts/Legend';
import { AveragesBox } from './parts/AveragesBox';
import { GeoLevel, GeoAverages } from './parts/types';
import { formatNumber } from '../../utils/formatters';

interface MapSidebarProps {
    level: GeoLevel;
    setLevel: (level: GeoLevel) => void;
    showPerCapita: boolean;
    setShowPerCapita: (val: boolean) => void;
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
}

export const MapSidebar: React.FC<MapSidebarProps> = ({
    level,
    setLevel,
    showPerCapita,
    setShowPerCapita,
    selectedRegionData,
    hoveredRegion,
    maxValue,
    metricLabel,
    averages,
    onCloseRegion,
    onShowCompanies
}) => {
    return (
        <div className="w-full md:w-80 bg-slate-50 border-r border-slate-200 flex flex-col h-full overflow-y-auto shrink-0 shadow-inner">
            <div className="p-4 space-y-6">
                {/* Header & Controls */}
                <section>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Kontroller</h3>

                    <div className="space-y-4">
                        {/* Level Picker */}
                        <div className="bg-white rounded-lg border border-slate-200 p-1 flex shadow-sm">
                            <button
                                onClick={() => setLevel('county')}
                                className={clsx(
                                    "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all",
                                    level === 'county' ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                <Layout className="w-3.5 h-3.5" />
                                Fylker
                            </button>
                            <button
                                onClick={() => setLevel('municipality')}
                                className={clsx(
                                    "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-md transition-all",
                                    level === 'municipality' ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-50"
                                )}
                            >
                                <MapIcon className="w-3.5 h-3.5" />
                                Kommuner
                            </button>
                        </div>

                        {/* Per Capita Toggle */}
                        <button
                            onClick={() => setShowPerCapita(!showPerCapita)}
                            className={clsx(
                                "w-full flex items-center justify-between px-4 py-3 text-xs font-bold rounded-xl border transition-all shadow-sm",
                                showPerCapita
                                    ? "bg-purple-50 border-purple-200 text-purple-700 ring-1 ring-purple-100"
                                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <Users className={clsx("h-4 w-4", showPerCapita ? "text-purple-600" : "text-slate-400")} />
                                <span>Per 1000 innbyggere</span>
                            </div>
                            <div className={clsx(
                                "w-8 h-4 rounded-full relative transition-colors",
                                showPerCapita ? "bg-purple-600" : "bg-slate-200"
                            )}>
                                <div className={clsx(
                                    "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all shadow-sm",
                                    showPerCapita ? "right-0.5" : "left-0.5"
                                )} />
                            </div>
                        </button>
                    </div>
                </section>

                <hr className="border-slate-200" />

                {/* Region Details */}
                <section className="flex-1">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Regiondetaljer</h3>

                    {selectedRegionData ? (
                        <div className="bg-white rounded-xl border border-blue-100 p-5 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className="text-lg font-black text-slate-900 leading-tight">{selectedRegionData.name}</h4>
                                    <p className="text-xs font-bold text-slate-400 uppercase">{level === 'county' ? 'Fylke' : 'Kommune'}</p>
                                </div>
                                <button
                                    onClick={onCloseRegion}
                                    className="p-1.5 hover:bg-slate-100 rounded-md text-slate-400 transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-4 mb-6">
                                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{metricLabel}</p>
                                    <p className="text-2xl font-black text-slate-900 tabular-nums">
                                        {showPerCapita ? selectedRegionData.value.toFixed(1) : formatNumber(selectedRegionData.value)}
                                        {showPerCapita && <span className="text-xs font-bold text-slate-400 ml-1">‰</span>}
                                    </p>
                                </div>

                                {selectedRegionData.population && (
                                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Innbyggertall</p>
                                        <p className="text-lg font-bold text-slate-700 tabular-nums">
                                            {formatNumber(selectedRegionData.population)}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => onShowCompanies?.(selectedRegionData.name, selectedRegionData.code)}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl text-sm font-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
                            >
                                Se bedrifter
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="py-8 text-center px-4">
                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <MapIcon className="w-6 h-6 text-slate-300" />
                            </div>
                            <p className="text-sm font-medium text-slate-400">Velg en region i kartet for å se detaljer</p>
                        </div>
                    )}
                </section>

                <hr className="border-slate-200" />

                {/* Statistics & Legend */}
                <section className="space-y-6 pb-4">
                    <Legend maxValue={maxValue} metricLabel={metricLabel} isVertical />

                    {!showPerCapita && averages && (
                        <div className="mt-4">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Gjennomsnitt</h3>
                            <AveragesBox
                                averages={averages}
                                level={level}
                                currentValue={hoveredRegion || undefined}
                                isSidebar
                            />
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};
