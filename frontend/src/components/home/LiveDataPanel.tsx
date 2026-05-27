import { Link } from '@tanstack/react-router'
import { ArrowRight, Building2, CircleDot, FileBarChart2, ShieldAlert } from 'lucide-react'
import { useStatsQuery } from '../../hooks/queries/useStatsQuery'
import { formatLargeNumber } from '../../utils/formatters'

const SKELETON_ROWS = Array.from({ length: 3 }, (_, index) => index)

function formatMetricValue(value: number | null | undefined, fallback: string) {
    return value != null ? formatLargeNumber(value) : fallback
}

export function LiveDataPanel() {
    const { data: stats, isLoading } = useStatsQuery()

    const activityCards = stats
        ? [
            {
                label: 'Nye virksomheter',
                value: formatMetricValue(stats.new_companies_30d, 'Se oversikt'),
                period: stats.new_companies_30d != null ? 'Siste 30 dager' : 'Nyeste oversikt',
                helper: 'Basert på registreringsdatoer i Enhetsregisteret.',
                to: '/nyetableringer' as const,
                action: 'Se nyetableringer',
                icon: Building2,
            },
            {
                label: 'Konkurser og avvikling',
                value: formatMetricValue(stats.bankruptcies, 'Se oversikt'),
                period: stats.bankruptcies != null ? 'Registrert i datagrunnlaget' : 'Egen oversikt',
                helper: 'Status bør kontrolleres mot Brreg ved juridisk bruk.',
                to: '/konkurser' as const,
                action: 'Se konkurser',
                icon: ShieldAlert,
            },
            {
                label: stats.total_accounting_reports != null ? 'Regnskapsgrunnlag' : 'Søkbar datadekning',
                value: formatMetricValue(stats.total_accounting_reports ?? stats.total_companies, 'Se data'),
                period: stats.total_accounting_reports != null ? 'Rapporter hos oss' : 'Virksomheter hos oss',
                helper: stats.total_accounting_reports != null
                    ? 'Dekning hos Bedriftsgrafen, ikke siste innsendingsdato.'
                    : 'Antall virksomheter som inngår i søk og analyse.',
                to: '/utforsk' as const,
                action: 'Utforsk datagrunnlaget',
                icon: FileBarChart2,
            },
        ]
        : []

    return (
        <section aria-labelledby="live-data-title" className="mb-10 px-4 sm:px-6 md:mb-14">
            <div className="mx-auto max-w-6xl rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_-48px_rgba(15,23,42,0.42)] transition-colors duration-300 dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_30px_80px_-48px_rgba(0,0,0,0.95)] md:p-8">
                <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 dark:border-slate-800 md:flex-row md:items-end md:justify-between">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/15 dark:text-emerald-200">
                            <CircleDot aria-hidden="true" className="h-3.5 w-3.5" />
                            Løpende datapuls
                        </div>
                        <h2 id="live-data-title" className="mt-4 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                            Siste bevegelser
                        </h2>
                        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
                            Nye virksomheter, statusendringer og datadekning samlet som raske innganger til ferske oversikter.
                        </p>
                    </div>
                    <div className="flex flex-col items-start gap-2 md:items-end">
                        <Link
                            to="/konkurser"
                            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-slate-300 dark:hover:text-blue-300 dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-900"
                        >
                            Se konkurser
                            <ArrowRight aria-hidden="true" className="h-4 w-4" />
                        </Link>
                        <Link
                            to="/nyetableringer"
                            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition-colors hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:text-slate-300 dark:hover:text-blue-300 dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-900"
                        >
                            Se nyetableringer
                            <ArrowRight aria-hidden="true" className="h-4 w-4" />
                        </Link>
                    </div>
                </div>

                <div aria-busy={isLoading} className="mt-5 grid gap-4 md:grid-cols-3">
                    {isLoading
                        ? SKELETON_ROWS.map((row) => (
                            <div key={row} className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950 sm:p-6">
                                <span className="sr-only">Laster datapunkter</span>
                                <div className="h-3 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                                <div className="mt-4 h-8 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                                <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                            </div>
                        ))
                        : activityCards.map((metric) => {
                            const Icon = metric.icon

                            return (
                            <Link
                                key={metric.label}
                                to={metric.to}
                                className="group rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white hover:shadow-[0_18px_45px_-36px_rgba(15,23,42,0.34)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-800 dark:bg-slate-950 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:hover:border-slate-700 dark:hover:bg-slate-900 dark:hover:shadow-[0_18px_45px_-36px_rgba(0,0,0,0.95)] dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-900 sm:p-6"
                            >
                                <dl>
                                    <div className="flex items-start justify-between gap-3">
                                        <dt className="text-sm font-medium text-slate-700 dark:text-slate-300">{metric.label}</dt>
                                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-400/20">
                                            <Icon aria-hidden="true" className="h-5 w-5" />
                                        </span>
                                    </div>
                                    <dd className="mt-3 text-3xl font-semibold tabular-nums text-slate-950 dark:text-white">{metric.value}</dd>
                                    <dd className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-500">{metric.period}</dd>
                                    <dd className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">{metric.helper}</dd>
                                </dl>
                                <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-800 transition-colors group-hover:text-blue-700 dark:text-blue-300 dark:group-hover:text-blue-200">
                                    {metric.action}
                                    <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                </span>
                            </Link>
                            )
                        })}
                </div>
            </div>
        </section>
    )
}