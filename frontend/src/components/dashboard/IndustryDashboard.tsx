import { useQuery } from '@tanstack/react-query';
import { Building2, TrendingUp, Users, Search, Settings, RotateCcw, Landmark } from 'lucide-react';
import React, { useState, useMemo, memo, useCallback, useRef, useEffect } from 'react';
import { API_BASE } from '../../utils/apiClient';
import { formatNumber, formatCurrency, formatPercentValue } from '../../utils/formatters';
import { CompanyListModal } from './CompanyListModal';
import { SummaryCard, SortableHeader, LoadingState, ErrorState } from '../common';
import { AffiliateBanner } from '../ads/AffiliateBanner';
import { CONTACT_EMAIL } from '../../constants/contact';

// ============================================================================
// Types
// ============================================================================

interface IndustryStat {
    nace_division: string;
    nace_name: string;
    company_count: number;
    bankrupt_count: number;
    new_last_year: number;
    bankruptcies_last_year: number;
    total_employees: number | null;
    avg_employees: number | null;
    total_revenue: number | null;
    avg_revenue: number | null;
    median_revenue: number | null;
    total_profit: number | null;
    avg_profit: number | null;
    profitable_count: number | null;
    avg_operating_margin: number | null;
}

interface IndustryTotals {
    companies: number;
    employees: number;
    revenue: number;
}

interface SelectedIndustry {
    naceCode: string;
    naceName: string;
    filterType: 'all' | 'new' | 'bankrupt';
}

type SortField = 'company_count' | 'total_revenue' | 'avg_revenue' | 'total_employees' | 'new_last_year' | 'bankruptcies_last_year' | 'avg_profit' | 'avg_operating_margin';
type SortOrder = 'asc' | 'desc';

// Optional columns configuration
type OptionalColumn = 'avg_profit' | 'avg_operating_margin' | 'profitable_count';
const OPTIONAL_COLUMNS: Record<OptionalColumn, { label: string; sortable: boolean }> = {
    avg_profit: { label: 'Gj.snitt Resultat', sortable: true },
    avg_operating_margin: { label: 'Driftsmargin', sortable: true },
    profitable_count: { label: 'Lønnsomme', sortable: false },
};
const OPTIONAL_COLUMN_ENTRIES = Object.entries(OPTIONAL_COLUMNS) as [OptionalColumn, typeof OPTIONAL_COLUMNS[OptionalColumn]][];
const DEFAULT_VISIBLE_COLUMNS: OptionalColumn[] = [];

// ============================================================================
// Utility Functions (pure, stable references)
// ============================================================================

// Formatters replaced by imports from ../../utils/formatters

const calculateTotals = (data: IndustryStat[]): IndustryTotals => ({
    companies: data.reduce((sum, d) => sum + d.company_count, 0),
    employees: data.reduce((sum, d) => sum + (d.total_employees ?? 0), 0),
    revenue: data.reduce((sum, d) => sum + (d.total_revenue ?? 0), 0),
});

// ============================================================================
// Memoized Sub-components
// ============================================================================

// SortHeader replaced by shared component from ../common

interface IndustryRowProps {
    industry: IndustryStat;
    onRowClick: (naceCode: string, naceName: string) => void;
    onNewClick: (naceCode: string, naceName: string) => void;
    onBankruptClick: (naceCode: string, naceName: string) => void;
    visibleOptionalColumns: OptionalColumn[];
}

const IndustryRow = memo(({ industry: ind, onRowClick, onNewClick, onBankruptClick, visibleOptionalColumns }: IndustryRowProps) => (
    <tr
        className="hover:bg-blue-50 cursor-pointer transition-colors group"
        onClick={() => onRowClick(ind.nace_division, ind.nace_name)}
    >
        <td className="px-4 py-3">
            <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                    {ind.nace_division}
                </span>
                <span className="text-sm text-gray-900 truncate max-w-[250px] group-hover:text-blue-700" title={ind.nace_name}>
                    {ind.nace_name}
                </span>
            </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">{formatNumber(ind.company_count)}</td>
        <td className="px-4 py-3 text-sm text-gray-700">{formatNumber(ind.total_employees)}</td>
        <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(ind.total_revenue)}</td>
        <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(ind.avg_revenue)}</td>
        {/* Optional columns */}
        {visibleOptionalColumns.includes('avg_profit') && (
            <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(ind.avg_profit)}</td>
        )}
        {visibleOptionalColumns.includes('avg_operating_margin') && (
            <td className="px-4 py-3 text-sm text-gray-700">
                {ind.avg_operating_margin != null ? formatPercentValue(ind.avg_operating_margin) : '—'}
            </td>
        )}
        {visibleOptionalColumns.includes('profitable_count') && (
            <td className="px-4 py-3 text-sm text-gray-700">
                {ind.profitable_count != null && ind.company_count > 0
                    ? `${formatNumber(ind.profitable_count)} (${Math.round((ind.profitable_count / ind.company_count) * 100)}%)`
                    : '—'}
            </td>
        )}
        <td className="px-4 py-3">
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onNewClick(ind.nace_division, ind.nace_name);
                }}
                className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium hover:bg-green-200 transition-colors"
            >
                +{formatNumber(ind.new_last_year)}
            </button>
        </td>
        <td className="px-4 py-3">
            {ind.bankruptcies_last_year > 0 ? (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onBankruptClick(ind.nace_division, ind.nace_name);
                    }}
                    className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium hover:bg-red-200 transition-colors"
                >
                    {formatNumber(ind.bankruptcies_last_year)}
                </button>
            ) : (
                <span className="text-xs text-gray-400">—</span>
            )}
        </td>
    </tr>
));
IndustryRow.displayName = 'IndustryRow';

// Column picker for optional columns
interface IndustryColumnPickerProps {
    visibleColumns: OptionalColumn[];
    onToggle: (col: OptionalColumn) => void;
    onReset: () => void;
}

const IndustryColumnPicker = memo(function IndustryColumnPicker({ visibleColumns, onToggle, onReset }: IndustryColumnPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') setIsOpen(false);
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen]);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-gray-600 hover:text-blue-600"
                title="Vis flere kolonner"
                aria-label="Vis flere kolonner"
            >
                <Settings className="h-4 w-4" />
            </button>
            {isOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 min-w-[180px]">
                    <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 uppercase">Ekstra kolonner</span>
                        <button
                            onClick={onReset}
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            title="Skjul alle"
                            aria-label="Skjul alle kolonner"
                        >
                            <RotateCcw className="h-3 w-3" />
                        </button>
                    </div>
                    {OPTIONAL_COLUMN_ENTRIES.map(([key, config]) => (
                        <label
                            key={key}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
                        >
                            <input
                                type="checkbox"
                                checked={visibleColumns.includes(key)}
                                onChange={() => onToggle(key)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">{config.label}</span>
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
});

// ============================================================================
// Main Component
// ============================================================================

interface IndustryDashboardProps {
    initialNace?: string;
}

export const IndustryDashboard = ({ initialNace }: IndustryDashboardProps) => {
    const [sortBy, setSortBy] = useState<SortField>('company_count');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
    const [selectedIndustry, setSelectedIndustry] = useState<SelectedIndustry | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [visibleOptionalColumns, setVisibleOptionalColumns] = useState<OptionalColumn[]>(DEFAULT_VISIBLE_COLUMNS);

    // Column toggle handlers
    const handleToggleColumn = useCallback((col: OptionalColumn) => {
        setVisibleOptionalColumns(prev =>
            prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
        );
    }, []);

    const handleResetColumns = useCallback(() => {
        setVisibleOptionalColumns(DEFAULT_VISIBLE_COLUMNS);
    }, []);

    // Fetch industry stats once - sorting is done client-side to avoid unnecessary API calls
    // Since we always get all ~50 industries, sorting locally is more efficient
    const { data: industries, isLoading, error, refetch } = useQuery<IndustryStat[]>({
        queryKey: ['industryStats'],
        queryFn: async () => {
            const res = await fetch(
                `${API_BASE}/v1/stats/industries?sort_by=company_count&sort_order=desc&limit=50`
            );
            if (!res.ok) throw new Error('Failed to fetch industry stats');
            return res.json();
        },
        staleTime: 1000 * 60 * 60, // 1 hour cache
        retry: 2,
    });

    // Track if we've already handled the initial nace param (to prevent re-opening after close)
    const handledNaceRef = React.useRef<string | null>(null);

    // Auto-open modal when navigating from company page with nace param
    // Using queueMicrotask to avoid synchronous setState in effect (React 18+ lint rule)
    React.useEffect(() => {
        // Only open if: initialNace exists, data loaded, and we haven't handled this nace yet
        if (initialNace && industries && handledNaceRef.current !== initialNace) {
            handledNaceRef.current = initialNace;
            const industry = industries.find(i => i.nace_division === initialNace);
            const naceName = industry?.nace_name || `NACE ${initialNace}`;
            // Defer setState to next microtask to satisfy lint rule
            queueMicrotask(() => {
                setSelectedIndustry({ naceCode: initialNace, naceName, filterType: 'all' });
            });
        }
    }, [initialNace, industries]);

    // Handlers
    const handleSort = useCallback((field: SortField) => {
        if (sortBy === field) {
            setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    }, [sortBy]);

    const handleRowClick = useCallback((naceCode: string, naceName: string) => {
        setSelectedIndustry({ naceCode, naceName, filterType: 'all' });
    }, []);

    const handleNewClick = useCallback((naceCode: string, naceName: string) => {
        setSelectedIndustry({ naceCode, naceName, filterType: 'new' });
    }, []);

    const handleBankruptClick = useCallback((naceCode: string, naceName: string) => {
        setSelectedIndustry({ naceCode, naceName, filterType: 'bankrupt' });
    }, []);

    const handleCloseModal = useCallback(() => {
        setSelectedIndustry(null);
    }, []);

    // Memoize totals calculation
    const totals = useMemo<IndustryTotals>(() => {
        if (!industries) return { companies: 0, employees: 0, revenue: 0 };
        return calculateTotals(industries);
    }, [industries]);

    // Filter and sort industries client-side
    const filteredIndustries = useMemo(() => {
        if (!industries) return [];

        // First filter by search query
        let result = industries;
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = industries.filter(
                ind => ind.nace_name.toLowerCase().includes(query) || ind.nace_division.includes(query)
            );
        }

        // Then sort client-side
        return [...result].sort((a, b) => {
            const aVal = a[sortBy] ?? 0;
            const bVal = b[sortBy] ?? 0;
            const comparison = typeof aVal === 'number' && typeof bVal === 'number'
                ? aVal - bVal
                : String(aVal).localeCompare(String(bVal));
            return sortOrder === 'desc' ? -comparison : comparison;
        });
    }, [industries, searchQuery, sortBy, sortOrder]);

    // Loading state
    if (isLoading) {
        return <LoadingState message="Laster bransjestatistikk..." />;
    }

    // Error state with retry button
    if (error) {
        return (
            <ErrorState
                title="Kunne ikke laste bransjestatistikk"
                message="Noe gikk galt ved henting av data."
                onRetry={() => refetch()}
            />
        );
    }

    return (
        <>
            <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SummaryCard
                        icon={<Building2 className="w-5 h-5" />}
                        label="Totalt Selskaper"
                        value={formatNumber(totals.companies)}
                    />
                    <SummaryCard
                        icon={<Users className="w-5 h-5" />}
                        label="Totalt Ansatte"
                        value={formatNumber(totals.employees)}
                    />
                    <SummaryCard
                        icon={<TrendingUp className="w-5 h-5" />}
                        label="Total Omsetning"
                        value={formatCurrency(totals.revenue)}
                    />
                </div>

                {/* Industry Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Bransjestatistikk</h2>
                            <p className="text-sm text-gray-500">Klikk på en bransje for å se selskaper</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Søk i bransjer..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-2 w-full sm:w-64 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <IndustryColumnPicker
                                visibleColumns={visibleOptionalColumns}
                                onToggle={handleToggleColumn}
                                onReset={handleResetColumns}
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Bransje
                                    </th>
                                    <SortableHeader field="company_count" label="Selskaper" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                    <SortableHeader field="total_employees" label="Ansatte" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                    <SortableHeader field="total_revenue" label="Omsetning" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                    <SortableHeader field="avg_revenue" label="Gj.snitt" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                    {/* Optional columns */}
                                    {visibleOptionalColumns.includes('avg_profit') && (
                                        <SortableHeader field="avg_profit" label="Gj.snitt Resultat" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                    )}
                                    {visibleOptionalColumns.includes('avg_operating_margin') && (
                                        <SortableHeader field="avg_operating_margin" label="Driftsmargin" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                    )}
                                    {visibleOptionalColumns.includes('profitable_count') && (
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lønnsomme</th>
                                    )}
                                    <SortableHeader field="new_last_year" label="Nye i år" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                    <SortableHeader field="bankruptcies_last_year" label="Konkurser" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredIndustries.length === 0 && searchQuery ? (
                                    <tr>
                                        <td colSpan={7 + visibleOptionalColumns.length} className="px-4 py-8 text-center text-gray-500">
                                            Ingen bransjer funnet for «{searchQuery}»
                                        </td>
                                    </tr>
                                ) : (
                                    filteredIndustries.map((ind) => (
                                        <IndustryRow
                                            key={ind.nace_division}
                                            industry={ind}
                                            onRowClick={handleRowClick}
                                            onNewClick={handleNewClick}
                                            onBankruptClick={handleBankruptClick}
                                            visibleOptionalColumns={visibleOptionalColumns}
                                        />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Affiliate Banner - Banking */}
                <AffiliateBanner
                    bannerId="banking_industry_dashboard"
                    placement="industry_dashboard"
                    title="Tilbyr dere bedriftskonto?"
                    description={`Nå ut til tusenvis av norske bedrifter. Denne annonseplassen er ledig for samarbeid. Kontakt oss på ${CONTACT_EMAIL}.`}
                    buttonText="Send e-post"
                    link={`mailto:${CONTACT_EMAIL}`}
                    icon={Landmark}
                    variant="banking"
                    isPlaceholder
                />
            </div>

            {/* Company List Modal */}
            {selectedIndustry && (
                <CompanyListModal
                    naceCode={selectedIndustry.naceCode}
                    naceName={selectedIndustry.naceName}
                    filterType={selectedIndustry.filterType}
                    onClose={handleCloseModal}
                />
            )}
        </>
    );
};

export default IndustryDashboard;
