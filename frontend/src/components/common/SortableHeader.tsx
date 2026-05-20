import React from 'react';
import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';

export type SortOrder = 'asc' | 'desc';

interface SortableHeaderProps<T extends string> extends React.ThHTMLAttributes<HTMLTableCellElement> {
    field: T;
    label: string;
    currentSort: string;
    sortOrder: SortOrder;
    onSort: (field: T) => void;
    sortable?: boolean;
}

export function SortableHeader<T extends string>({
    field,
    label,
    currentSort,
    sortOrder,
    onSort,
    sortable = true,
    className = '',
    ...props
}: SortableHeaderProps<T>) {
    if (!sortable) {
        return (
            <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400 ${className}`} {...props}>
                {label}
            </th>
        );
    }

    const isCurrentSort = currentSort === field;
    const nextSortOrder = isCurrentSort && sortOrder === 'asc' ? 'synkende' : 'stigende';

    return (
        <th
            className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-slate-400 ${className}`}
            aria-sort={isCurrentSort ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
            {...props}
        >
            <button
                type="button"
                onClick={() => onSort(field)}
                className="flex items-center gap-1 rounded text-left uppercase tracking-wider hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:hover:text-slate-200 dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-900"
                aria-label={`Sorter etter ${label}, ${nextSortOrder}`}
            >
                {label}
                {isCurrentSort ? (
                    sortOrder === 'desc' ? (
                        <ChevronDown className="h-3 w-3 text-blue-600 dark:text-blue-300" aria-hidden="true" />
                    ) : (
                        <ChevronUp className="h-3 w-3 text-blue-600 dark:text-blue-300" aria-hidden="true" />
                    )
                ) : (
                    <ArrowUpDown className="h-3 w-3 text-gray-300 dark:text-slate-600" aria-hidden="true" />
                )}
            </button>
        </th>
    );
}
