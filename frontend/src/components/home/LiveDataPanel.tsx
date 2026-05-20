import { Link } from '@tanstack/react-router'
import { ArrowRight, CircleDot } from 'lucide-react'
import { useStatsQuery } from '../../hooks/queries/useStatsQuery'
import { formatLargeNumber } from '../../utils/formatters'

const SKELETON_ROWS = Array.from({ length: 3 }, (_, index) => index)

export function LiveDataPanel() {
    const { data: stats, isLoading } = useStatsQuery()

    const secondaryMetric = (() => {
        if (!stats) {
            return null
        }

        if (stats.new_companies_ytd != null) {
            return {
                label: 'Nye virksomheter hittil i år',
                value: formatLargeNumber(stats.new_companies_ytd),
                helper: 'Brukes for å følge tempo og etableringstrykk.',
            }
        }

        if (stats.total_accounting_reports != null) {
            return {
                label: 'Regnskapsrapporter',
                value: formatLargeNumber(stats.total_accounting_reports),
                helper: 'Grunnlaget for finansiell analyse på tvers av selskaper.',
            }
        }

        return {
            label: 'Søkbar datadekning',
            value: formatLargeNumber(stats.total_companies),
            helper: 'Antall virksomheter som inngår i søk, sammenligning og analyse.',
        }
    })()

    const metrics = stats && secondaryMetric
        ? [
            {
                label: 'Nye virksomheter siste 30 dager',
                value: formatLargeNumber(stats.new_companies_30d),
                helper: 'Et løpende bilde av nyetableringer i markedet.',
            },
            secondaryMetric,
            {
                label: 'Geokodede virksomheter',
                value: formatLargeNumber(stats.geocoded_count),
                helper: 'Gir grunnlag for områdesøk og kartanalyse.',
            },
        ]
        : []

    return (
        <section aria-labelledby="live-data-title" className="mb-10 px-4 sm:px-6 md:mb-14">
            <div className="mx-auto max-w-6xl rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.42)] md:p-8">
                <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                            <CircleDot aria-hidden="true" className="h-3.5 w-3.5" />
                            Løpende datapuls
                        </div>
                        <h2 id="live-data-title" className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                            Følg bevegelsen i norske virksomheter
                        </h2>
                        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                            Nøkkeltallene under viser aktivitet, dekning og oppdatering i datagrunnlaget.
                        </p>
                    </div>
                    <div className="flex flex-col items-start gap-2 md:items-end">
                        <Link
                            to="/konkurser"
                            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        >
                            Se konkurser
                            <ArrowRight aria-hidden="true" className="h-4 w-4" />
                        </Link>
                        <Link
                            to="/nyetableringer"
                            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        >
                            Se nyetableringer
                            <ArrowRight aria-hidden="true" className="h-4 w-4" />
                        </Link>
                    </div>
                </div>

                <div aria-busy={isLoading} className="mt-5 grid gap-4 md:grid-cols-3">
                    {isLoading
                        ? SKELETON_ROWS.map((row) => (
                            <div key={row} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
                                <span className="sr-only">Laster datapunkter</span>
                                <div className="h-3 w-28 animate-pulse rounded bg-slate-200" />
                                <div className="mt-4 h-8 w-20 animate-pulse rounded bg-slate-200" />
                                <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-200" />
                            </div>
                        ))
                        : metrics.map((metric) => (
                            <dl key={metric.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] sm:p-6">
                                <div>
                                    <dt className="text-sm font-medium text-slate-700">{metric.label}</dt>
                                    <dd className="mt-3 text-3xl font-semibold tabular-nums text-slate-950">{metric.value}</dd>
                                    <dd className="mt-3 text-sm leading-6 text-slate-600">{metric.helper}</dd>
                                </div>
                            </dl>
                        ))}
                </div>
            </div>
        </section>
    )
}