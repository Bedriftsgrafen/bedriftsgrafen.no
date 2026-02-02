import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { NacePicker } from '../NacePicker';

interface SearchControlsProps {
    query: string | null;
    setQuery: (query: string | null) => void;
    naceCode: string | null;
    setNaceCode: (code: string | null) => void;
}

export const SearchControls: React.FC<SearchControlsProps> = ({
    query,
    setQuery,
    naceCode,
    setNaceCode,
}) => {
    // Initialize state from props once at mount
    const [localQuery, setLocalQuery] = useState(() => query || '');

    // Debounce query changes
    useEffect(() => {
        const timer = setTimeout(() => {
            if (localQuery !== (query || '')) {
                setQuery(localQuery || null);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [localQuery, setQuery, query]);

    return (
        <section className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Firma & Bransje</h3>

            <div className="space-y-4">
                {/* Search Input */}
                <div>
                    <label htmlFor="sidebar-search-input" className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                        Søk virksomheter
                    </label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            id="sidebar-search-input"
                            type="text"
                            value={localQuery}
                            onChange={(e) => setLocalQuery(e.target.value)}
                            placeholder="Navn eller org.nr..."
                            className="block w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-lg hover:border-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm outline-none placeholder:text-slate-400"
                        />
                        {localQuery && (
                            <button
                                onClick={() => { setLocalQuery(''); setQuery(null); }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Nace Picker */}
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 ml-1">
                        Bransje
                    </label>
                    <NacePicker
                        value={naceCode}
                        onChange={setNaceCode}
                        className="w-full"
                    />
                </div>
            </div>
        </section>
    );
};
