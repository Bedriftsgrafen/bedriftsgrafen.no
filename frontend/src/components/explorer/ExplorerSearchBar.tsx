import { useState, useEffect, useCallback, useMemo, type KeyboardEvent } from 'react';
import { Search, MapPin, ChevronRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useMunicipalitiesListQuery } from '../../hooks/queries/useMunicipalityQuery';
import clsx from 'clsx';

interface ExplorerSearchBarProps {
    initialValue: string;
    onSearch: (query: string) => void;
    isLoading?: boolean;
    placeholder?: string;
}

/**
 * Action-triggered search bar for the Explorer page.
 * Prevents per-keystroke server load by using local state.
 */
export function ExplorerSearchBar({
    initialValue,
    onSearch,
    isLoading = false,
    placeholder = "Søk etter bedrift, bransje eller formål..."
}: ExplorerSearchBarProps) {
    const [localValue, setLocalValue] = useState(initialValue);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const { data: municipalities } = useMunicipalitiesListQuery();

    const suggestions = useMemo(() => {
        if (!localValue || localValue.length < 2 || !municipalities) return [];

        const searchTerms = localValue.toLowerCase().split(' ');

        return municipalities
            .filter(m => {
                const name = m.name.toLowerCase();
                return searchTerms.every(term => name.includes(term) || m.code.includes(term));
            })
            .slice(0, 5); // Limit to 5 suggestions
    }, [localValue, municipalities]);

    // Sync from props (e.g. when clicking recent searches or clearing filters)
    useEffect(() => {
        setLocalValue(initialValue);
    }, [initialValue]);

    const handleAction = useCallback(() => {
        setShowSuggestions(false);
        onSearch(localValue);
    }, [onSearch, localValue]);

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleAction();
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    return (
        <div className="relative w-full group">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={localValue}
                        onChange={(e) => {
                            setLocalValue(e.target.value);
                            setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none shadow-sm transition-all text-slate-900 placeholder-slate-400"
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />

                    {/* Suggestions Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                            <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Forslag: Steder</span>
                                <button
                                    onClick={() => setShowSuggestions(false)}
                                    className="text-[10px] text-slate-400 hover:text-slate-600 font-bold"
                                >
                                    LUKK
                                </button>
                            </div>
                            <div className="max-h-[300px] overflow-y-auto py-1">
                                {suggestions.map(m => (
                                    <Link
                                        key={m.code}
                                        to="/kommune/$code"
                                        params={{ code: m.slug }}
                                        onClick={() => setShowSuggestions(false)}
                                        className="flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                <MapPin className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900">{m.name}</p>
                                                <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">Kommune ({m.code})</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-400 tabular-nums">{m.company_count.toLocaleString('no-NO')} bedrifter</span>
                                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                                        </div>
                                    </Link>
                                ))}

                                <div
                                    className="px-4 py-3 border-t border-slate-50 flex items-center gap-3 cursor-pointer hover:bg-slate-50 transition-colors"
                                    onClick={handleAction}
                                >
                                    <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center">
                                        <Search className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900">Søk etter "{localValue}"</p>
                                        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-tighter">I alle bedrifter</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <button
                    onClick={handleAction}
                    disabled={isLoading}
                    className={clsx(
                        "px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20",
                        "hover:bg-blue-700 active:scale-95 transition-all text-sm flex items-center gap-2",
                        "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                    )}
                >
                    {isLoading ? (
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <Search className="h-4 w-4" />
                    )}
                    Søk
                </button>
            </div>
        </div>
    );
}
