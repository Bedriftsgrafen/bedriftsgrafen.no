import { RangeInput } from './RangeInput'
import { MNOK_MULTIPLIER } from '../../utils/financials'
import { FilterValues } from '../../store/filterStore'

interface FinancialFiltersProps {
    draftFilters: FilterValues
    handleRangeChange: (field: string, isMin: boolean, value: string, multiplier?: number) => void
    handleHasAccountingChange: (value: string) => void
}

export function FinancialFilters({
    draftFilters,
    handleRangeChange,
    handleHasAccountingChange
}: FinancialFiltersProps) {
    return (
        <section className="space-y-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100 pb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Økonomi
            </h3>

            <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">Regnskapsdata</label>
                <div className="flex gap-2 p-1 bg-slate-100/50 rounded-xl">
                    {[{ value: 'all', label: 'Alle' }, { value: 'yes', label: 'Med' }, { value: 'no', label: 'Uten' }]
                        .map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => handleHasAccountingChange(opt.value)}
                                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${draftFilters.hasAccounting === (opt.value === 'yes' ? true : opt.value === 'no' ? false : null)
                                    ? 'bg-white shadow-sm text-blue-600 ring-1 ring-slate-200'
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                </div>
            </div>

            <div className="space-y-4">
                <RangeInput
                    label="Omsetning (mill. kr)"
                    fieldName="revenue"
                    minValue={draftFilters.revenueMin}
                    maxValue={draftFilters.revenueMax}
                    onChange={handleRangeChange}
                    multiplier={MNOK_MULTIPLIER}
                />
                <RangeInput
                    label="Årsresultat (mill. kr)"
                    fieldName="profit"
                    minValue={draftFilters.profitMin}
                    maxValue={draftFilters.profitMax}
                    onChange={handleRangeChange}
                    multiplier={MNOK_MULTIPLIER}
                />
                <RangeInput
                    label="Egenkapital (mill. kr)"
                    fieldName="equity"
                    minValue={draftFilters.equityMin}
                    maxValue={draftFilters.equityMax}
                    onChange={handleRangeChange}
                    multiplier={MNOK_MULTIPLIER}
                />
                <RangeInput
                    label="Driftsresultat (mill. kr)"
                    fieldName="operatingProfit"
                    minValue={draftFilters.operatingProfitMin}
                    maxValue={draftFilters.operatingProfitMax}
                    onChange={handleRangeChange}
                    multiplier={MNOK_MULTIPLIER}
                />
            </div>
        </section>
    )
}
