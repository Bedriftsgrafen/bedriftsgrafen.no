import { useStatsQuery } from '../../hooks/queries/useStatsQuery'
import { formatLargeNumber } from '../../utils/formatters'

const SKELETON_CELLS = Array.from({ length: 4 }, (_, index) => index)

export function TrustMetrics() {
    const { data: stats, isLoading } = useStatsQuery()

    const metrics = [
        { label: 'Virksomheter', value: stats ? formatLargeNumber(stats.total_companies) : '-' },
        { label: 'Roller og personer', value: stats ? formatLargeNumber(stats.total_roles) : '-' },
        { label: 'Nye siste 30 dager', value: stats ? formatLargeNumber(stats.new_companies_30d) : '-' },
        { label: 'Oppdatert fra Brønnøysund', value: 'Daglig' },
    ]

    return (
        <section aria-labelledby="trust-metrics-title" className="mb-10 px-4 sm:px-6 md:mb-14">
            <h2 id="trust-metrics-title" className="sr-only">Nøkkeltall</h2>
            <div aria-busy={isLoading} className="mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-slate-300 bg-slate-50 shadow-[0_22px_50px_-36px_rgba(15,23,42,0.32)]">
                <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 md:grid-cols-4 md:divide-y-0">
                    {isLoading
                        ? SKELETON_CELLS.map((cell) => (
                            <div key={cell} className="bg-slate-50 p-5 sm:p-6 md:p-7">
                                <span className="sr-only">Laster nøkkeltall</span>
                                <div className="h-9 w-24 animate-pulse rounded bg-slate-200" />
                                <div className="mt-3 h-3 w-32 animate-pulse rounded bg-slate-200" />
                            </div>
                        ))
                        : metrics.map((metric) => (
                            <dl key={metric.label} className="bg-slate-50 p-5 sm:p-6 md:p-7">
                                <div className="flex flex-col">
                                    <dt className="order-2 mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 sm:text-sm">
                                        {metric.label}
                                    </dt>
                                    <dd className="order-1 text-[2rem] font-semibold tabular-nums text-slate-950 sm:text-[2.25rem] md:text-[2.5rem]">
                                        {metric.value}
                                    </dd>
                                </div>
                            </dl>
                        ))}
                </div>
            </div>
        </section>
    )
}