import { useState, useEffect, useCallback, type KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
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

    // Sync from props (e.g. when clicking recent searches or clearing filters)
    useEffect(() => {
        setLocalValue(initialValue);
    }, [initialValue]);

    const handleAction = useCallback(() => {
        onSearch(localValue);
    }, [onSearch, localValue]);

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleAction();
        }
    };

    return (
        <div className="relative w-full group">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={localValue}
                        onChange={(e) => setLocalValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none shadow-sm transition-all text-slate-900 placeholder-slate-400"
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
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
