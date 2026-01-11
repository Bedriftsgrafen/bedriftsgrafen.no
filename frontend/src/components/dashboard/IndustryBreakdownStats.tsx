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
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
};

const HOVER_COLORS: Record<ColorScheme, string> = {
    green: 'hover:bg-green-50',
    red: 'hover:bg-red-50',
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
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className={`animate-spin w-8 h-8 border-2 border-${colorScheme === 'green' ? 'green' : 'red'}-500 border-t-transparent rounded-full mx-auto`} />
                <p className="text-gray-500 mt-4">Laster statistikk...</p>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                <p className="text-red-600">Kunne ikke laste statistikk</p>
            </div>
        );
    }

    const Icon = colorScheme === 'green' ? TrendingUp : TrendingDown;

    return (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Header with search */}
            <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 text-${colorScheme === 'green' ? 'green' : 'red'}-600`} />
                    <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Søk i bransjer..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`pl-9 pr-4 py-2 w-full sm:w-64 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-${colorScheme === 'green' ? 'green' : 'red'}-500 focus:border-${colorScheme === 'green' ? 'green' : 'red'}-500`}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50">
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
                    <tbody className="divide-y divide-gray-100">
                        {sortedIndustries.length === 0 && searchQuery ? (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
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
                                        className={`${HOVER_COLORS[colorScheme]} cursor-pointer transition-colors`}
                                        onClick={() => onIndustryClick?.(ind.nace_division, ind.nace_name)}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                                                    {ind.nace_division}
                                                </span>
                                                <span className="text-sm text-gray-900 truncate max-w-[300px]" title={ind.nace_name}>
                                                    {ind.nace_name}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${BADGE_COLORS[colorScheme]}`}>
                                                {formatNumber(value)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm text-gray-600">
                                            {percentage}%
                                        </td>
                                        <td className="px-4 py-3 text-right text-sm text-gray-500">
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
            <div className="p-4 border-t border-gray-200 bg-gray-50 text-sm text-gray-600">
                Totalt: <span className="font-semibold">{formatNumber(total)}</span> {metric === 'new_last_year' ? 'nyetableringer' : 'konkurser'} fordelt på {industries?.length ?? 0} bransjer
            </div>
        </div>
    );
});
