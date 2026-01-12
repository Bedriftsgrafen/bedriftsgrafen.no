import { useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Building2, ExternalLink } from 'lucide-react';
import { useNavigate } from '@tanstack/react-router';
import { getOneYearAgo } from '../../utils/dates';
import { formatNumber, formatCurrency, formatDate } from '../../utils/formatters';
import { useCompaniesQuery, UseCompaniesQueryParams } from '../../hooks/queries/useCompaniesQuery';
import { useCompanyCountQuery, UseCompanyCountQueryParams } from '../../hooks/queries/useCompanyCountQuery';
import { SortableHeader } from '../common/SortableHeader';
import { LoadingState } from '../common/LoadingState';
import { ErrorState } from '../common/ErrorState';

// ============================================================================
// Types
// ============================================================================

type SortField = 'stiftelsesdato' | 'konkursdato' | 'navn' | 'revenue' | 'kommune' | 'antall_ansatte';
type SortOrder = 'asc' | 'desc';

interface CompanyListModalProps {
    naceCode: string;
    naceName: string;
    filterType: 'all' | 'new' | 'bankrupt';
    onClose: () => void;
}

// ============================================================================
// Utilities
// ============================================================================

const truncateText = (text: string | null | undefined, maxLen: number = 50): string => {
    if (!text) return '—';
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen).trim() + '…';
};

// ============================================================================
// Main Component
// ============================================================================

export const CompanyListModal = ({
    naceCode,
    naceName,
    filterType,
    onClose,
}: CompanyListModalProps) => {
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const pageSize = 20;

    // Sorting state - default depends on filter type
    const getDefaultSort = (): { field: SortField; order: SortOrder } => {
        switch (filterType) {
            case 'new': return { field: 'stiftelsesdato', order: 'desc' };
            case 'bankrupt': return { field: 'konkursdato', order: 'desc' };
            default: return { field: 'revenue', order: 'desc' };
        }
    };
    const [sortField, setSortField] = useState<SortField>(getDefaultSort().field);
    const [sortOrder, setSortOrder] = useState<SortOrder>(getDefaultSort().order);

    const handleCompanyClick = useCallback((orgnr: string) => {
        onClose();
        navigate({ to: '/bedrift/$orgnr', params: { orgnr } });
    }, [navigate, onClose]);

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
        setPage(1); // Reset to first page when sorting changes
    };

    // Prepare Query Params
    const queryParams: UseCompaniesQueryParams = {
        skip: (page - 1) * pageSize,
        limit: pageSize,
        naeringskode: naceCode,
        sort_by: sortField,
        sort_order: sortOrder,
    };

    const countParams: UseCompanyCountQueryParams = {
        naeringskode: naceCode,
    }

    if (filterType === 'new') {
        const oneYearAgo = getOneYearAgo();
        queryParams.founded_from = oneYearAgo;
        queryParams.exclude_org_form = ['KBO'];

        countParams.founded_from = oneYearAgo;
        countParams.exclude_org_form = ['KBO'];
    } else if (filterType === 'bankrupt') {
        const oneYearAgo = getOneYearAgo();
        queryParams.bankrupt_from = oneYearAgo;
        queryParams.is_bankrupt = true;

        countParams.bankrupt_from = oneYearAgo;
        countParams.is_bankrupt = true;
    }

    // Fetch companies
    const { data: companies, isLoading, isError } = useCompaniesQuery(queryParams);

    // Fetch count
    const { data: totalCount } = useCompanyCountQuery(countParams);

    const totalPages = totalCount ? Math.ceil(totalCount / pageSize) : 0;

    // Generate title based on filter type
    const getTitle = () => {
        switch (filterType) {
            case 'new':
                return `Nye selskaper siste år: ${naceName}`;
            case 'bankrupt':
                return `Konkurser siste år: ${naceName}`;
            default:
                return `Selskaper i: ${naceName}`;
        }
    };
    const title = getTitle();

    // Sortable header component - matches CompanyList styling
    // Must be defined before render functions that use it (no hoisting for const arrow functions)
    // Sortable header component - matches CompanyList styling
    // Must be defined before render functions that use it (no hoisting for const arrow functions)
    // Replaced by shared component

    // Different table layouts for new companies vs regular view
    const renderNewCompaniesTable = () => (
        <table className="w-full">
            <thead className="bg-blue-50/50">
                <tr>
                    <SortableHeader field="navn" label="Selskap" currentSort={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <SortableHeader field="kommune" label="Kommune" className="hidden sm:table-cell" currentSort={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <SortableHeader field="stiftelsesdato" label="Stiftet" currentSort={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase hidden md:table-cell">
                        Formål
                    </th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {companies?.map((company) => (
                    <tr
                        key={company.orgnr}
                        className="hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => handleCompanyClick(company.orgnr)}
                    >
                        <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{company.navn}</p>
                                    <p className="text-xs text-gray-500">
                                        {company.orgnr} • {company.organisasjonsform}
                                    </p>
                                </div>
                                <ExternalLink className="w-3 h-3 text-gray-400 shrink-0" />
                            </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                            {company.forretningsadresse?.kommune || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDate(company.stiftelsesdato)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell" title={company.vedtektsfestet_formaal || undefined}>
                            {truncateText(company.vedtektsfestet_formaal, 40)}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );



    const renderBankruptciesTable = () => (
        <table className="w-full">
            <thead className="bg-blue-50/50">
                <tr>
                    <SortableHeader field="navn" label="Selskap" currentSort={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <SortableHeader field="kommune" label="Kommune" className="hidden sm:table-cell" currentSort={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <SortableHeader field="konkursdato" label="Konkursdato" currentSort={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase hidden md:table-cell">
                        Formål
                    </th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {companies?.map((company) => (
                    <tr
                        key={company.orgnr}
                        className="hover:bg-red-50 cursor-pointer transition-colors"
                        onClick={() => handleCompanyClick(company.orgnr)}
                    >
                        <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{company.navn}</p>
                                    <p className="text-xs text-gray-500">
                                        {company.orgnr} • {company.organisasjonsform}
                                    </p>
                                </div>
                                <ExternalLink className="w-3 h-3 text-gray-400 shrink-0" />
                            </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                            {company.forretningsadresse?.kommune || '—'}
                        </td>
                        <td className="px-4 py-3">
                            <span className="text-sm text-red-700 bg-red-50 px-2 py-0.5 rounded-full font-medium">
                                {formatDate(company.konkursdato)}
                            </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 hidden md:table-cell" title={company.vedtektsfestet_formaal || undefined}>
                            {truncateText(company.vedtektsfestet_formaal, 40)}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    const renderRegularTable = () => (
        <table className="w-full">
            <thead className="bg-blue-50/50">
                <tr>
                    <SortableHeader field="navn" label="Selskap" currentSort={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <SortableHeader field="kommune" label="Kommune" className="hidden sm:table-cell" currentSort={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <SortableHeader field="antall_ansatte" label="Ansatte" className="text-right" currentSort={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    <SortableHeader field="revenue" label="Omsetning" className="text-right" currentSort={sortField} sortOrder={sortOrder} onSort={handleSort} />
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {companies?.map((company) => (
                    <tr
                        key={company.orgnr}
                        className="hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => handleCompanyClick(company.orgnr)}
                    >
                        <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{company.navn}</p>
                                    <p className="text-xs text-gray-500">
                                        {company.orgnr} • {company.organisasjonsform}
                                    </p>
                                </div>
                                <ExternalLink className="w-3 h-3 text-gray-400 shrink-0" />
                            </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 hidden sm:table-cell">
                            {company.forretningsadresse?.kommune || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                            {formatNumber(company.antall_ansatte)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">
                            {formatCurrency(company.latest_revenue)}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    );

    return (
        <div
            className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-4xl my-8"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                            <p className="text-sm text-gray-500">
                                NACE {naceCode} • {totalCount !== undefined ? formatNumber(totalCount) : '—'} selskaper
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label="Lukk"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    {isLoading ? (
                        <div className="py-12">
                            <LoadingState message="Laster selskaper..." className="border-0 shadow-none" />
                        </div>
                    ) : isError ? (
                        <div className="py-12">
                            <ErrorState message="Kunne ikke laste selskaper" className="max-w-md mx-auto" />
                        </div>
                    ) : !companies || companies.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            Ingen selskaper funnet
                        </div>
                    ) : (
                        <>
                            {/* Different table based on view type */}
                            <div className="overflow-x-auto">
                                {filterType === 'new' ? renderNewCompaniesTable() :
                                    filterType === 'bankrupt' ? renderBankruptciesTable() :
                                        renderRegularTable()}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                                    <p className="text-sm text-gray-500">
                                        Side {page} av {totalPages}
                                    </p>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setPage(p => Math.max(1, p - 1))}
                                            disabled={page === 1}
                                            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                            disabled={page === totalPages}
                                            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CompanyListModal;
