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
        <div className={`flex items-center gap-2 ${isCompact ? 'w-full min-w-0' : 'mb-6'}`}>
            <div
                className={`
                    rounded-lg border border-slate-200/50 bg-slate-100/80 p-1 shadow-inner dark:border-slate-700 dark:bg-slate-950/80
                    ${isCompact ? 'grid w-full min-w-0 grid-cols-3 gap-0.5' : 'flex overflow-hidden'}
                `}
                aria-label="Velg periode"
            >
                {periods.map((p) => (
                    <button
                        key={p.value}
                        type="button"
                        onClick={() => handlePeriodChange(p.value)}
                        aria-pressed={activePeriod === p.value}
                        className={`
                            relative min-w-0 rounded-md font-medium transition-all duration-200 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:focus-visible:ring-blue-200 dark:focus-visible:ring-offset-slate-950
                            ${activePeriod === p.value
                                ? 'border border-slate-200 bg-white text-slate-900 shadow-sm dark:border-blue-300/50 dark:bg-blue-500 dark:text-slate-950'
                                : 'text-slate-500 hover:bg-slate-200/50 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                            } 
                            ${isCompact ? 'flex items-center justify-center px-1 py-1 text-[10px] leading-tight sm:px-1.5 sm:text-[11px]' : 'flex-1 px-4 py-1.5 text-sm'}
                        `}
                    >
                        {isCompact ? p.compactLabel : p.label}
                    </button>
                ))}
            </div>
            {!isCompact && (
                <div className="ml-2 hidden items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 sm:flex">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Markedspuls</span>
                </div>
            )}
        </div>
    )
})
