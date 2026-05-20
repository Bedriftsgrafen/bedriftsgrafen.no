/**
 * Industry Breakdown Statistics Component
 * Shows industry-level breakdown for bankruptcies or new companies
 * Reusable across /konkurser and /nyetableringer pages
 */

import { useQuery } from '@tanstack/react-query';
import { memo, useMemo, useState, useCallback } from 'react';
import { Search, TrendingDown, TrendingUp } from 'lucide-react';
import { API_BASE } from '../../utils/apiClient';
import { formatNumber } from '../../utils/formatters';
import { SortableHeader } from '../common/SortableHeader';

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
}

type MetricType = 'new_last_year' | 'bankruptcies_last_year';
type ColorScheme = 'green' | 'red';
type SortColumn = 'name' | 'metric' | 'percentage' | 'total';
type SortOrder = 'asc' | 'desc';

interface IndustryBreakdownStatsProps {
    /** Which metric to sort by and display */
    metric: MetricType;
    /** Title for the table */
    title: string;
    /** Color scheme for badges */
    colorScheme: ColorScheme;
    /** Optional: callback when clicking an industry */
    onIndustryClick?: (naceCode: string, naceName: string) => void;
}

// ============================================================================
// Color utilities
// ============================================================================

const BADGE_COLORS: Record<ColorScheme, string> = {
    green: 'bg-green-100 text-green-700 dark:bg-emerald-500/15 dark:text-emerald-100 dark:ring-1 dark:ring-emerald-400/20',
    red: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-100 dark:ring-1 dark:ring-red-400/20',
};

const HOVER_COLORS: Record<ColorScheme, string> = {
    green: 'hover:bg-green-50 dark:hover:bg-emerald-500/12',
    red: 'hover:bg-red-50 dark:hover:bg-red-500/12',
};

const ICON_COLORS: Record<ColorScheme, string> = {
    green: 'text-green-600 dark:text-emerald-300',
    red: 'text-red-600 dark:text-red-300',
};

const SPINNER_COLORS: Record<ColorScheme, string> = {
    green: 'border-green-500 dark:border-emerald-300',
    red: 'border-red-500 dark:border-red-300',
};

const INPUT_FOCUS_COLORS: Record<ColorScheme, string> = {
    green: 'focus:border-green-500 focus:ring-green-500 dark:focus:border-emerald-300 dark:focus:ring-emerald-300',
    red: 'focus:border-red-500 focus:ring-red-500 dark:focus:border-red-300 dark:focus:ring-red-300',
};

// ============================================================================
// Sortable Header Component
// ============================================================================

// SortableHeader imported from ../common/SortableHeader

// ============================================================================
// Component
// ============================================================================

export const IndustryBreakdownStats = memo(function IndustryBreakdownStats({
    metric,
    title,
    colorScheme,
    onIndustryClick,
}: IndustryBreakdownStatsProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortColumn, setSortColumn] = useState<SortColumn>('metric');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    // Fetch industry stats (always get all, sort client-side)
    const { data: industries, isLoading, error } = useQuery<IndustryStat[]>({
        queryKey: ['industryStats', metric],
        queryFn: async () => {
            const res = await fetch(
                `${API_BASE}/v1/stats/industries?sort_by=${metric}&sort_order=desc&limit=100`
            );
            if (!res.ok) throw new Error('Failed to fetch industry stats');
            return res.json();
        },
        staleTime: 1000 * 60 * 60, // 1 hour cache
    });

    // Calculate total for percentage
    const total = useMemo(() => {
        if (!industries) return 0;
        return industries.reduce((sum, ind) => sum + (ind[metric] ?? 0), 0);
    }, [industries, metric]);

    // Handle column sort click
    const handleSort = useCallback((column: SortColumn) => {
        if (column === sortColumn) {
            // Toggle order if same column
            setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
        } else {
            // New column: default to desc for numbers, asc for name
            setSortColumn(column);
            setSortOrder(column === 'name' ? 'asc' : 'desc');
        }
    }, [sortColumn]);

    // Filter and sort industries
    const sortedIndustries = useMemo(() => {
        if (!industries) return [];

        // Filter first
        let filtered = industries;
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = industries.filter(
                ind => ind.nace_name.toLowerCase().includes(query) || ind.nace_division.includes(query)
            );
        }

        // Sort
        const sorted = [...filtered].sort((a, b) => {
            let comparison = 0;

            switch (sortColumn) {
                case 'name':
                    comparison = a.nace_name.localeCompare(b.nace_name, 'nb');
                    break;
                case 'metric':
                    comparison = (a[metric] ?? 0) - (b[metric] ?? 0);
                    break;
                case 'percentage': {
                    const pctA = total > 0 ? (a[metric] ?? 0) / total : 0;
                    const pctB = total > 0 ? (b[metric] ?? 0) / total : 0;
                    comparison = pctA - pctB;
                    break;
                }
                case 'total':
                    comparison = a.company_count - b.company_count;
                    break;
            }

            return sortOrder === 'desc' ? -comparison : comparison;
        });

        return sorted;
    }, [industries, searchQuery, sortColumn, sortOrder, metric, total]);

    // Loading state
    if (isLoading) {
        return (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
                <div className={`mx-auto h-8 w-8 animate-spin rounded-full border-2 border-t-transparent ${SPINNER_COLORS[colorScheme]}`} />
                <p className="mt-4 text-gray-500 dark:text-slate-300">Laster statistikk...</p>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-400/30 dark:bg-red-500/10">
                <p className="text-red-600 dark:text-red-200">Kunne ikke laste statistikk</p>
            </div>
        );
    }

    const Icon = colorScheme === 'green' ? TrendingUp : TrendingDown;

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {/* Header with search */}
            <div className="flex flex-col justify-between gap-3 border-b border-gray-200 p-4 dark:border-slate-800 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                    <Icon className={`h-5 w-5 ${ICON_COLORS[colorScheme]}`} aria-hidden="true" />
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-slate-500" aria-hidden="true" />
                    <input
                        type="text"
                        placeholder="Søk i bransjer..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full rounded-lg border border-gray-300 bg-white py-2 pr-4 pl-9 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 sm:w-64 ${INPUT_FOCUS_COLORS[colorScheme]}`}
                        aria-label="Søk i bransjer"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-slate-950">
                        <tr>
                            <SortableHeader
                                label="Bransje"
                                field="name"
                                currentSort={sortColumn}
                                sortOrder={sortOrder}
                                onSort={handleSort}
                                className="text-left"
                            />
                            <SortableHeader
                                label="Antall"
                                field="metric"
                                currentSort={sortColumn}
                                sortOrder={sortOrder}
                                onSort={handleSort}
                                className="text-right"
                            />
                            <SortableHeader
                                label="Andel"
                                field="percentage"
                                currentSort={sortColumn}
                                sortOrder={sortOrder}
                                onSort={handleSort}
                                className="text-right"
                            />
                            <SortableHeader
                                label="Totalt i bransjen"
                                field="total"
                                currentSort={sortColumn}
                                sortOrder={sortOrder}
                                onSort={handleSort}
                                className="text-right"
                            />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                        {sortedIndustries.length === 0 && searchQuery ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-gray-500 dark:text-slate-300">
                                    Ingen bransjer funnet for «{searchQuery}»
                                </td>
                            </tr>
                        ) : (
                            sortedIndustries.map((ind) => {
                                const value = ind[metric] ?? 0;
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';

                                return (
                                    <tr
                                        key={ind.nace_division}
                                        className={`${HOVER_COLORS[colorScheme]} ${onIndustryClick ? 'cursor-pointer' : ''} transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 dark:focus-visible:ring-blue-300`}
                                        onClick={() => onIndustryClick?.(ind.nace_division, ind.nace_name)}
                                        onKeyDown={(event) => {
                                            if (!onIndustryClick) return;
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                onIndustryClick(ind.nace_division, ind.nace_name);
                                            }
                                        }}
                                        tabIndex={onIndustryClick ? 0 : undefined}
                                        aria-label={onIndustryClick ? `Vis virksomheter i ${ind.nace_name}` : undefined}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-700 dark:bg-slate-800 dark:text-slate-100">
                                                    {ind.nace_division}
                                                </span>
                                                <span className="max-w-75 truncate text-sm text-gray-900 dark:text-white" title={ind.nace_name}>
                                                    {ind.nace_name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${BADGE_COLORS[colorScheme]}`}>
                                                {formatNumber(value)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm text-gray-600 dark:text-slate-200">
                                            {percentage}%
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm text-gray-500 dark:text-slate-300">
                                            {formatNumber(ind.company_count)}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer with total */}
            <div className="border-t border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                Totalt: <span className="font-semibold">{formatNumber(total)}</span> {metric === 'new_last_year' ? 'nyetableringer' : 'konkurser'} fordelt på {industries?.length ?? 0} bransjer
            </div>
        </div>
    );
});
