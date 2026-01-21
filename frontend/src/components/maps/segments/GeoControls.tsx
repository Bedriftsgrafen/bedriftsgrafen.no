import React, { useMemo } from 'react';
import { Layout, Map as MapIcon, Users } from 'lucide-react';
import clsx from 'clsx';
import { GeoLevel } from '../parts/types';
import { COUNTIES } from '../../../constants/explorer';
import { MUNICIPALITIES } from '../../../constants/municipalityCodes';

interface GeoControlsProps {
    level: GeoLevel;
    setLevel: (level: GeoLevel) => void;
    countyCode: string | null;
    setCountyCode: (code: string | null) => void;
    municipalityCode: string | null;
    setMunicipalityCode: (code: string | null) => void;
    showPerCapita: boolean;
    setShowPerCapita: (val: boolean) => void;
}

export const GeoControls: React.FC<GeoControlsProps> = ({
    level,
    setLevel,
    countyCode,
    setCountyCode,
    municipalityCode,
    setMunicipalityCode,
    showPerCapita,
    setShowPerCapita,
}) => {
    const filteredMunicipalities = useMemo(() => {
        if (!countyCode) return [];
        return MUNICIPALITIES.filter(m => m.code.startsWith(countyCode))
            .sort((a, b) => a.name.localeCompare(b.name, 'nb'));
    }, [countyCode]);

    return (
        <section className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Geografi</h3>

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

                {/* County Filter */}
                <div>
                    <label htmlFor="sidebar-county-select" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                        Fylke
                    </label>
                    <select
                        id="sidebar-county-select"
                        value={countyCode || ''}
                        onChange={(e) => {
                            const code = e.target.value;
                            setCountyCode(code || null);
                            setMunicipalityCode(null);
                        }}
                        className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm outline-none"
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
                    <label htmlFor="sidebar-municipality-select" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                        Kommune
                    </label>
                    <select
                        id="sidebar-municipality-select"
                        value={municipalityCode || ''}
                        onChange={(e) => setMunicipalityCode(e.target.value || null)}
                        disabled={!countyCode}
                        className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm disabled:opacity-50 disabled:bg-slate-50 outline-none"
                    >
                        <option value="">Alle kommuner</option>
                        {filteredMunicipalities.map((m) => (
                            <option key={m.code} value={m.code}>
                                {m.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Per Capita Toggle */}
                <button
                    onClick={() => setShowPerCapita(!showPerCapita)}
                    className={clsx(
                        "w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold rounded-xl border transition-all shadow-sm",
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
    );
};
