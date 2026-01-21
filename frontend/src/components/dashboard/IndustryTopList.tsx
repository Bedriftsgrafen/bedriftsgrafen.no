import { useMemo, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { Building2, ArrowRight, Award } from 'lucide-react';
import { useCompaniesQuery } from '../../hooks/queries/useCompaniesQuery';
import { formatCurrency, formatPercentValue } from '../../utils/formatters';
import { LoadingState, ErrorState, SortableHeader } from '../common';

interface IndustryTopListProps {
    naceCode?: string;
    onSelectCompany: (orgnr: string) => void;
}

type SortField = 'revenue' | 'profit' | 'operating_margin' | 'antall_ansatte' | 'navn';
type SortOrder = 'asc' | 'desc';

/**
 * IndustryTopList - Shows the top 100 companies in an industry by revenue.
 * Dense table view for side-by-side comparison of major players.
 */
export function IndustryTopList({ naceCode, onSelectCompany }: IndustryTopListProps) {
    const [sortBy, setSortBy] = useState<SortField>('revenue');
    const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

    // Mapped sort field for API
    const apiSortBy = useMemo(() => {
        switch (sortBy) {
            case 'revenue': return 'revenue';
            case 'profit': return 'profit';
            case 'operating_margin': return 'operating_margin';
            case 'antall_ansatte': return 'antall_ansatte';
            case 'navn': return 'navn';
            default: return 'revenue';
        }
    }, [sortBy]);

    const { data: companies, isLoading, isError, refetch } = useCompaniesQuery({
        limit: 100,
        naeringskode: naceCode,
        sort_by: apiSortBy,
        sort_order: sortOrder,
        has_accounting: true, // Only show companies with financials
    });

    const handleSort = useCallback((field: SortField) => {
        if (sortBy === field) {
            setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    }, [sortBy]);

    if (isLoading) return <LoadingState message="Henter toppliste..." />;
    if (isError) return <ErrorState message="Kunne ikke laste toppliste" onRetry={() => refetch()} />;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Context Header */}
            <div className="gradient-noise rounded-2xl p-6 text-white shadow-lg overflow-hidden relative">
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <Award className="h-6 w-6 text-yellow-400" />
                        <h2 className="text-xl font-bold">Topp 100 - {naceCode || 'Hele Norge'}</h2>
                    </div>
                    <p className="text-blue-100 max-w-2xl">
                        Oversikt over de største aktørene sortert etter omsetning.
                        Klikk på kolonnene for å endre sortering eller velg en bedrift for detaljer.
                    </p>
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-5 py-4 font-semibold text-gray-900 w-16 text-center">#</th>
                                <SortableHeader
                                    field="navn"
                                    label="Selskap"
                                    currentSort={sortBy}
                                    sortOrder={sortOrder}
                                    onSort={() => handleSort('navn')}
                                    className="px-5 py-4"
                                />
                                <SortableHeader
                                    field="revenue"
                                    label="Omsetning"
                                    currentSort={sortBy}
                                    sortOrder={sortOrder}
                                    onSort={() => handleSort('revenue')}
                                    className="px-5 py-4 text-right"
                                />
                                <SortableHeader
                                    field="profit"
                                    label="Resultat"
                                    currentSort={sortBy}
                                    sortOrder={sortOrder}
                                    onSort={() => handleSort('profit')}
                                    className="px-5 py-4 text-right"
                                />
                                <SortableHeader
                                    field="operating_margin"
                                    label="Margin"
                                    currentSort={sortBy}
                                    sortOrder={sortOrder}
                                    onSort={() => handleSort('operating_margin')}
                                    className="px-5 py-4 text-right"
                                />
                                <SortableHeader
                                    field="antall_ansatte"
                                    label="Ansatte"
                                    currentSort={sortBy}
                                    sortOrder={sortOrder}
                                    onSort={() => handleSort('antall_ansatte')}
                                    className="px-5 py-4 text-right"
                                />
                                <th className="px-5 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {companies?.map((company, index) => (
                                <tr
                                    key={company.orgnr}
                                    onClick={() => onSelectCompany(company.orgnr)}
                                    className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                                >
                                    <td className="px-5 py-4 text-gray-400 font-mono text-center">
                                        {index + 1}
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate max-w-xs sm:max-w-md">
                                            {company.navn}
                                        </div>
                                        <div className="text-xs text-gray-500 font-mono">
                                            {company.orgnr}
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-right font-medium text-gray-900 tabular-nums">
                                        {formatCurrency(company.latest_revenue)}
                                    </td>
                                    <td className={clsx(
                                        "px-5 py-4 text-right tabular-nums font-medium",
                                        (company.latest_profit ?? 0) > 0 ? "text-green-600" : (company.latest_profit ?? 0) < 0 ? "text-red-600" : "text-gray-900"
                                    )}>
                                        {formatCurrency(company.latest_profit)}
                                    </td>
                                    <td className="px-5 py-4 text-right tabular-nums">
                                        {company.latest_operating_margin != null
                                            ? formatPercentValue(company.latest_operating_margin)
                                            : '—'
                                        }
                                    </td>
                                    <td className="px-5 py-4 text-right text-gray-600 tabular-nums">
                                        {company.antall_ansatte ?? '—'}
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all inline-block" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {companies?.length === 0 && (
                    <div className="p-12 text-center">
                        <Building2 className="h-12 w-12 text-gray-200 mx-auto mb-4" />
                        <p className="text-gray-500">Ingen selskaper funnet i topplisten.</p>
                    </div>
                )}
            </div>

            {/* Footnote */}
            <p className="text-xs text-gray-400 px-4">
                * Topplisten er basert på sist innsendte årsregnskap fra Brønnøysundregistrene.
            </p>
        </div>
    );
}

