import { memo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Calendar } from 'lucide-react'

type Period = '30d' | '90d' | '1y'

interface PeriodSelectorProps {
    activePeriod: Period
    variant?: 'default' | 'compact'
    route?: '/nyetableringer' | '/konkurser'
}

export const PeriodSelector = memo(function PeriodSelector({
    activePeriod,
    variant = 'default',
    route
}: PeriodSelectorProps) {
    const navigate = useNavigate()
    const isCompact = variant === 'compact'

    const periods: { value: Period; label: string; compactLabel: string }[] = [
        { value: '30d', label: 'Siste 30 dager', compactLabel: '30d' },
        { value: '90d', label: 'Siste 90 dager', compactLabel: '90d' },
        { value: '1y', label: 'Siste år', compactLabel: '1 år' },
    ]

    const handlePeriodChange = (period: Period) => {
        if (route) {
            navigate({
                to: route,
                search: (prev: Record<string, unknown>) => ({ ...prev, period })
            })
        }
    }

    return (
        <div className={`flex items-center gap-2 ${isCompact ? 'w-full max-w-full overflow-hidden' : 'mb-6'}`}>
            <div className={`
                flex bg-slate-100/80 rounded-lg shadow-inner border border-slate-200/50 overflow-hidden
                ${isCompact ? 'p-1 w-full' : 'p-1'}
            `}>
                {periods.map((p) => (
                    <button
                        key={p.value}
                        onClick={() => handlePeriodChange(p.value)}
                        className={`
                            relative flex-1 px-3 py-1 text-sm font-medium rounded-md transition-all duration-200 whitespace-nowrap
                            ${activePeriod === p.value
                                ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                            } 
                            ${isCompact ? 'py-1 text-[11px] leading-tight flex justify-center items-center' : 'px-4 py-1.5'}
                        `}
                    >
                        {isCompact ? p.compactLabel : p.label}
                    </button>
                ))}
            </div>
            {!isCompact && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 ml-2 font-medium">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Markedspuls</span>
                </div>
            )}
        </div>
    )
})
