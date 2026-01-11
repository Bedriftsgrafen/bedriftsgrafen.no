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

    return (
        <th
            className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors select-none ${className}`}
            onClick={() => onSort(field)}
            {...props}
        >
            <div className="flex items-center gap-1">
                {label}
                {currentSort === field ? (
                    sortOrder === 'desc' ? (
                        <ChevronDown className="w-3 h-3 text-blue-600" />
                    ) : (
                        <ChevronUp className="w-3 h-3 text-blue-600" />
                    )
                ) : (
                    <ArrowUpDown className="w-3 h-3 text-gray-300" />
                )}
            </div>
        </th>
    );
}
