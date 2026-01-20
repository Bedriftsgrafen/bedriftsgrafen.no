import { RangeInput } from './RangeInput'
import { StatusFilters } from './StatusFilters'
import { FilterValues } from '../../store/filterStore'

interface StatusAndDateFiltersProps {
    draftFilters: FilterValues
    handleRangeChange: (field: string, isMin: boolean, value: string, multiplier?: number) => void
    handleDateChange: (isFrom: boolean, value: string) => void
    handleBankruptDateChange: (isFrom: boolean, value: string) => void
    handleStatusChange: (key: 'isBankrupt' | 'inLiquidation' | 'inForcedLiquidation', value: boolean | null) => void
}

export function StatusAndDateFilters({
    draftFilters,
    handleRangeChange,
    handleDateChange,
    handleBankruptDateChange,
    handleStatusChange
}: StatusAndDateFiltersProps) {
    return (
        <section className="space-y-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                Status & Dato
            </h3>

            <div className="space-y-4">
                <RangeInput
                    label="Ansatte"
                    fieldName="employee"
                    minValue={draftFilters.employeeMin}
                    maxValue={draftFilters.employeeMax}
                    onChange={handleRangeChange}
                />
                <div className="grid grid-cols-2 gap-4">
                    <RangeInput
                        label="Likviditetsgrad"
                        fieldName="liquidityRatio"
                        minValue={draftFilters.liquidityRatioMin}
                        maxValue={draftFilters.liquidityRatioMax}
                        onChange={handleRangeChange}
                        step="0.1"
                    />
                    <RangeInput
                        label="EK-andel (0-1)"
                        fieldName="equityRatio"
                        minValue={draftFilters.equityRatioMin}
                        maxValue={draftFilters.equityRatioMax}
                        onChange={handleRangeChange}
                        step="0.1"
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Stiftelsesdato</label>
                    <div className="space-y-1">
                        <input
                            type="date"
                            value={draftFilters.foundedFrom?.toISOString().split('T')[0] || ''}
                            onChange={(e) => handleDateChange(true, e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-xs transition-all"
                        />
                        <input
                            type="date"
                            value={draftFilters.foundedTo?.toISOString().split('T')[0] || ''}
                            onChange={(e) => handleDateChange(false, e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-xs transition-all"
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Konkursdato</label>
                    <div className="space-y-1">
                        <input
                            type="date"
                            value={draftFilters.bankruptFrom?.toISOString().split('T')[0] || ''}
                            onChange={(e) => handleBankruptDateChange(true, e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-xs transition-all"
                        />
                        <input
                            type="date"
                            value={draftFilters.bankruptTo?.toISOString().split('T')[0] || ''}
                            onChange={(e) => handleBankruptDateChange(false, e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none text-xs transition-all"
                        />
                    </div>
                </div>
            </div>

            <StatusFilters
                isBankrupt={draftFilters.isBankrupt}
                inLiquidation={draftFilters.inLiquidation}
                inForcedLiquidation={draftFilters.inForcedLiquidation}
                onStatusChange={handleStatusChange}
            />
        </section>
    )
}
