import { useState, useEffect, useCallback, useMemo, useId, type KeyboardEvent } from 'react';
import { Search, MapPin, ChevronRight } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useMunicipalitiesListQuery } from '../../hooks/queries/useMunicipalityQuery';
import clsx from 'clsx';
import { getCompanySearchValidationMessage } from '../../utils/searchValidation';

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
    placeholder = "Søk etter virksomhet, bransje eller formål..."
}: ExplorerSearchBarProps) {
    const [localValue, setLocalValue] = useState(initialValue);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputId = useId();
    const validationMessage = getCompanySearchValidationMessage(localValue);

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
        // eslint-disable-next-line @eslint-react/set-state-in-effect
        setLocalValue(initialValue);
    }, [initialValue]);

    const handleAction = useCallback(() => {
        if (validationMessage) return;
        setShowSuggestions(false);
        onSearch(localValue);
    }, [onSearch, localValue, validationMessage]);

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
                    <label htmlFor={inputId} className="sr-only">
                        Søk etter virksomhet, bransje eller formål
                    </label>
                    <input
                        id={inputId}
                        type="text"
                        value={localValue}
                        onChange={(e) => {
                            setLocalValue(e.target.value);
                            setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-slate-900 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/15"
                    />
                    <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500 dark:text-slate-500 dark:group-focus-within:text-blue-300" aria-hidden="true" />

                    {/* Suggestions Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="animate-in fade-in slide-in-from-top-2 absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40">
                            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Forslag: Steder</span>
                                <button
                                    type="button"
                                    onClick={() => setShowSuggestions(false)}
                                    className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                                    aria-label="Lukk søkeforslag"
                                >
                                    LUKK
                                </button>
                            </div>
                            <div className="max-h-75 overflow-y-auto py-1">
                                {suggestions.map(m => (
                                    <Link
                                        key={m.code}
                                        to="/kommune/$code"
                                        params={{ code: m.slug }}
                                        onClick={() => setShowSuggestions(false)}
                                        className="group flex items-center justify-between px-4 py-3 transition-colors hover:bg-blue-50 dark:hover:bg-white/5"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-900 transition-colors group-hover:bg-blue-900 group-hover:text-white dark:bg-blue-500/15 dark:text-blue-200 dark:group-hover:bg-blue-500 dark:group-hover:text-slate-950">
                                                <MapPin className="h-4 w-4" aria-hidden="true" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-900 dark:text-white">{m.name}</p>
                                                <p className="text-[10px] font-medium uppercase tracking-tighter text-slate-500 dark:text-slate-400">Kommune ({m.code})</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold tabular-nums text-slate-400 dark:text-slate-500">{m.company_count.toLocaleString('no-NO')} virksomheter</span>
                                            <ChevronRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-blue-600 dark:text-slate-600 dark:group-hover:text-blue-300" aria-hidden="true" />
                                        </div>
                                    </Link>
                                ))}

                                <button
                                    type="button"
                                    disabled={Boolean(validationMessage)}
                                    className="flex w-full items-center gap-3 border-t border-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:border-slate-800 dark:hover:bg-white/5 dark:focus-visible:ring-blue-300"
                                    onClick={handleAction}
                                >
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-400">
                                        <Search className="h-4 w-4" aria-hidden="true" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-slate-900 dark:text-white">Søk etter "{localValue}"</p>
                                        <p className="text-[10px] font-medium uppercase tracking-tighter text-slate-500 dark:text-slate-400">I alle virksomheter</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    onClick={handleAction}
                    disabled={isLoading || Boolean(validationMessage)}
                    className={clsx(
                        "px-6 py-3 bg-blue-900 text-white rounded-xl font-bold shadow-lg shadow-blue-950/20",
                        "hover:bg-blue-800 active:scale-95 transition-all text-sm flex items-center gap-2 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400",
                        "disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                    )}
                >
                    {isLoading ? (
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden="true" />
                    ) : (
                        <Search className="h-4 w-4" aria-hidden="true" />
                    )}
                    Søk
                </button>
            </div>
            {validationMessage && (
                <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-300" role="status">
                    {validationMessage}
                </p>
            )}
        </div>
    );
}
