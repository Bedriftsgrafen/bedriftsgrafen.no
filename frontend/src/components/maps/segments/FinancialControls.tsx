import React from 'react';
import { TrendingUp, Landmark, Users } from 'lucide-react';
import { RangeInput } from '../../filter/RangeInput';
import { MapFilterValues } from '../../../types/map';

interface FinancialControlsProps {
    filters: MapFilterValues;
    onChange: (updates: Partial<MapFilterValues>) => void;
}

export const FinancialControls: React.FC<FinancialControlsProps> = ({
    filters,
    onChange,
}) => {
    const handleRangeChange = (field: string, isMin: boolean, value: string, multiplier: number = 1) => {
        const numValue = value === '' ? null : parseFloat(value) * multiplier;
        const finalField = `${field}${isMin ? 'Min' : 'Max'}` as keyof MapFilterValues;
        onChange({ [finalField]: numValue });
    };

    return (
        <section className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Økonomi</h3>

            <div className="space-y-6">
                {/* Revenue Range */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs">
                        <TrendingUp size={14} className="text-blue-500" />
                        <span>Omsetning (MNOK)</span>
                    </div>
                    <RangeInput
                        label=""
                        fieldName="revenue"
                        minValue={filters.revenueMin}
                        maxValue={filters.revenueMax}
                        onChange={handleRangeChange}
                        multiplier={1000000}
                    />
                </div>

                {/* Profit Range */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs">
                        <Landmark size={14} className="text-emerald-500" />
                        <span>Årsresultat (MNOK)</span>
                    </div>
                    <RangeInput
                        label=""
                        fieldName="profit"
                        minValue={filters.profitMin}
                        maxValue={filters.profitMax}
                        onChange={handleRangeChange}
                        multiplier={1000000}
                    />
                </div>

                {/* Employee Range */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs">
                        <Users size={14} className="text-purple-500" />
                        <span>Ansatte</span>
                    </div>
                    <RangeInput
                        label=""
                        fieldName="employee"
                        minValue={filters.employeeMin}
                        maxValue={filters.employeeMax}
                        onChange={handleRangeChange}
                    />
                </div>
            </div>
        </section>
    );
};
