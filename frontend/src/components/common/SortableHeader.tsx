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
            <th className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`} {...props}>
                {label}
            </th>
        );
    }

    const isCurrentSort = currentSort === field;
    const nextSortOrder = isCurrentSort && sortOrder === 'asc' ? 'synkende' : 'stigende';

    return (
        <th
            className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`}
            aria-sort={isCurrentSort ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
            {...props}
        >
            <button
                type="button"
                onClick={() => onSort(field)}
                className="flex items-center gap-1 rounded text-left uppercase tracking-wider hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                aria-label={`Sorter etter ${label}, ${nextSortOrder}`}
            >
                {label}
                {isCurrentSort ? (
                    sortOrder === 'desc' ? (
                        <ChevronDown className="w-3 h-3 text-blue-600" aria-hidden="true" />
                    ) : (
                        <ChevronUp className="w-3 h-3 text-blue-600" aria-hidden="true" />
                    )
                ) : (
                    <ArrowUpDown className="w-3 h-3 text-gray-300" aria-hidden="true" />
                )}
            </button>
        </th>
    );
}
