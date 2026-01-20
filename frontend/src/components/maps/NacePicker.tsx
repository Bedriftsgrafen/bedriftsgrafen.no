import { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import { NACE_CODES, NACE_DIVISIONS } from '../../constants/explorer';

interface NacePickerProps {
    value: string | null;
    onChange: (value: string | null) => void;
    placeholder?: string;
    className?: string;
}

export function NacePicker({ value, onChange, placeholder = 'Alle bransjer', className = '' }: NacePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Compute options based on search term
    const groupedOptions = useMemo(() => {
        const results: { section: string; sectionName: string; divisions: { code: string; name: string }[] }[] = [];
        const lowerSearch = searchTerm.toLowerCase();

        for (const section of NACE_CODES) {
            const sectionMatch =
                section.code.toLowerCase().includes(lowerSearch) ||
                section.name.toLowerCase().includes(lowerSearch);

            const matchingDivisions = (NACE_DIVISIONS[section.code] || []).filter(div =>
                div.code.toLowerCase().includes(lowerSearch) ||
                div.name.toLowerCase().includes(lowerSearch)
            );

            if (sectionMatch || matchingDivisions.length > 0) {
                results.push({
                    section: section.code,
                    sectionName: section.name,
                    divisions: matchingDivisions
                });
            }
        }

        return results;
    }, [searchTerm]);

    const selectedName = useMemo(() => {
        if (!value) return null;

        // Check if it's a section
        const section = NACE_CODES.find(s => s.code === value);
        if (section) return `${section.code} - ${section.name}`;

        // Check if it's a division
        for (const sectionKey in NACE_DIVISIONS) {
            const div = NACE_DIVISIONS[sectionKey].find(d => d.code === value);
            if (div) return `${div.code} - ${div.name}`;
        }

        return value; // Fallback to just the code
    }, [value]);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-white/80 backdrop-blur-md border border-gray-200 rounded-xl hover:bg-white hover:border-gray-300 transition-all active:scale-[0.98] text-sm text-left shadow-sm"
            >
                <span className={`block truncate ${!value ? 'text-gray-500' : 'text-gray-900 font-medium'}`}>
                    {selectedName || placeholder}
                </span>
                <div className="flex items-center gap-1 text-gray-400">
                    {value && (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                onChange(null);
                            }}
                            className="p-1 hover:bg-gray-100 rounded-md hover:text-gray-600 transition-colors"
                        >
                            <X size={14} />
                        </div>
                    )}
                    <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {isOpen && (
                <div className="absolute z-1000 mt-2 w-full min-w-[320px] bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top">
                    {/* Search bar */}
                    <div className="p-3 border-b border-gray-100 bg-gray-50/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Søk i bransjer..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="max-h-[400px] overflow-y-auto overscroll-contain pb-2">
                        {groupedOptions.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 text-sm">
                                Ingen bransjer funnet for "{searchTerm}"
                            </div>
                        ) : (
                            groupedOptions.map((group) => (
                                <div key={group.section} className="border-b border-gray-50 last:border-0">
                                    {/* Section header (also selectable) */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onChange(group.section);
                                            setIsOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between px-4 py-2.5 hover:bg-blue-50/50 text-left transition-colors ${value === group.section ? 'bg-blue-50' : ''
                                            }`}
                                    >
                                        <span className={`text-sm ${value === group.section ? 'text-blue-700 font-semibold' : 'text-gray-900 font-bold'}`}>
                                            {group.section} - {group.sectionName}
                                        </span>
                                        {value === group.section && <Check size={16} className="text-blue-600" />}
                                    </button>

                                    {/* Divisions */}
                                    {group.divisions.map((div) => (
                                        <button
                                            key={div.code}
                                            type="button"
                                            onClick={() => {
                                                onChange(div.code);
                                                setIsOpen(false);
                                            }}
                                            className={`w-full flex items-center justify-between pl-8 pr-4 py-2 hover:bg-gray-50 text-left transition-colors ${value === div.code ? 'bg-blue-50' : ''
                                                }`}
                                        >
                                            <span className={`text-sm ${value === div.code ? 'text-blue-700 font-medium' : 'text-gray-600'}`}>
                                                {div.code} - {div.name}
                                            </span>
                                            {value === div.code && <Check size={16} className="text-blue-600" />}
                                        </button>
                                    ))}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
