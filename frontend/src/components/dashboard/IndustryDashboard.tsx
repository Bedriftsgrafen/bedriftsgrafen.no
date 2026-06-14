import { useQuery } from '@tanstack/react-query';
import { Building2, TrendingUp, Users, Search, Settings, RotateCcw, ExternalLink } from 'lucide-react';
import { useState, useMemo, memo, useCallback, useRef, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { API_BASE } from '../../utils/apiClient';
import { formatNumber, formatCurrency, formatPercentValue } from '../../utils/formatters';
import { createRouteCode } from '../../utils/slugify';
import { SummaryCard, SortableHeader, LoadingState, ErrorState } from '../common';
import { RotatingAffiliateBanner } from '../ads/RotatingAffiliateBanner';
import { ALL_AFFILIATIONS } from '../../constants/affiliations';
import { NaceHierarchyBrowser } from './NaceHierarchyBrowser';

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
    visibleOptionalColumns: OptionalColumn[];
}

const IndustryRow = memo(({ industry: ind, visibleOptionalColumns }: IndustryRowProps) => (
    <tr className="hover:bg-blue-50 transition-colors group">
        <td className="px-4 py-3">
            <Link
                to="/bransje/$code"
                params={{ code: createRouteCode(ind.nace_division, ind.nace_name) }}
                className="flex items-center gap-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
                aria-label={`Åpne bransjeside for ${ind.nace_name}`}
            >
                <span className="text-xs font-mono bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                    {ind.nace_division}
                </span>
                <span className="text-sm text-gray-900 truncate max-w-62.5 group-hover:text-blue-700" title={ind.nace_name}>
                    {ind.nace_name}
                </span>
            </Link>
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
            <Link
                to="/nyetableringer"
                search={{ nace: ind.nace_division }}
                aria-label={`Vis nyetableringer i ${ind.nace_name}`}
                className="text-xs bg-blue-900 text-white px-2 py-0.5 rounded-full font-medium hover:bg-blue-800 transition-colors"
            >
                +{formatNumber(ind.new_last_year)}
            </Link>
        </td>
        <td className="px-4 py-3">
            {ind.bankruptcies_last_year > 0 ? (
                <Link
                    to="/konkurser"
                    search={{ nace: ind.nace_division }}
                    aria-label={`Vis konkurser i ${ind.nace_name}`}
                    className="text-xs bg-blue-900 text-white px-2 py-0.5 rounded-full font-medium hover:bg-blue-800 transition-colors"
                >
                    {formatNumber(ind.bankruptcies_last_year)}
                </Link>
            ) : (
                <span className="text-xs text-gray-400">—</span>
            )}
        </td>
        <td className="px-4 py-3">
            <Link
                to="/bransje/$code"
                params={{ code: createRouteCode(ind.nace_division, ind.nace_name) }}
                onClick={(e) => e.stopPropagation()}
                className="text-slate-400 hover:text-blue-600 transition-colors"
                title={`Se bransjeside for ${ind.nace_name}`}
                aria-label={`Se bransjeside for ${ind.nace_name}`}
            >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </Link>
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
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 hover:bg-blue-100 rounded-lg transition-colors text-gray-600 hover:text-blue-600"
                title="Vis flere kolonner"
                aria-label="Vis flere kolonner"
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                <Settings className="h-4 w-4" aria-hidden="true" />
            </button>
            {isOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 min-w-45">
                    <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-500 uppercase">Ekstra kolonner</span>
                        <button
                            type="button"
                            onClick={onReset}
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            title="Skjul alle"
                            aria-label="Skjul alle kolonner"
                        >
                            <RotateCcw className="h-3 w-3" aria-hidden="true" />
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

    // Handlers
    const handleSort = useCallback((field: SortField) => {
        if (sortBy === field) {
            setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    }, [sortBy]);

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
            <div className="space-y-6 min-w-0">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <SummaryCard
                        icon={<Building2 className="w-5 h-5" />}
                        label="Totalt Virksomheter"
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

                <RotatingAffiliateBanner
                    placement="industry_dashboard_top"
                    candidates={ALL_AFFILIATIONS}
                    className="mb-6"
                />

                <NaceHierarchyBrowser initialNace={initialNace} divisionStats={industries ?? []} />

                {/* Industry Table */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Bransjestatistikk</h2>
                            <p className="text-sm text-gray-500">Åpne bransjesiden, eller bruk kodeverket over for å filtrere mer presist.</p>
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
                                    aria-label="Søk i bransjer"
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
                                    <SortableHeader field="company_count" label="Virksomheter" currentSort={sortBy} sortOrder={sortOrder} onSort={handleSort} />
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
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                                        <span className="sr-only">Bransjeside</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredIndustries.length === 0 && searchQuery ? (
                                    <tr>
                                        <td colSpan={8 + visibleOptionalColumns.length} className="px-4 py-8 text-center text-gray-500">
                                            Ingen bransjer funnet for «{searchQuery}»
                                        </td>
                                    </tr>
                                ) : (
                                    filteredIndustries.map((ind) => (
                                        <IndustryRow
                                            key={ind.nace_division}
                                            industry={ind}
                                            visibleOptionalColumns={visibleOptionalColumns}
                                        />
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

        </>
    );
};

export default IndustryDashboard;
