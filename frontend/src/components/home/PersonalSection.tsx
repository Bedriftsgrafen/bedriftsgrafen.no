import { Link } from '@tanstack/react-router'
import { Clock3, Star } from 'lucide-react'
import { useFavoritesStore } from '../../store/favoritesStore'
import { useUiStore } from '../../store/uiStore'
import { formatDistanceToNow } from '../../utils/formatters'

export function PersonalSection() {
    const favorites = useFavoritesStore((s) => s.favorites)
    const clearFavorites = useFavoritesStore((s) => s.clearFavorites)
    const recentCompanies = useUiStore((s) => s.recentCompanies)
    const clearRecentCompanies = useUiStore((s) => s.clearRecentCompanies)

    if (favorites.length === 0 && recentCompanies.length === 0) {
        return null
    }

    return (
        <section aria-labelledby="personal-section-title" className="mb-10 min-w-0 px-4 sm:px-6 md:mb-14">
            <div className="mx-auto max-w-6xl min-w-0">
                <div className="mb-6">
                    <h2 id="personal-section-title" className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
                        Fortsett der du slapp
                    </h2>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300 sm:text-lg">
                        Personlige snarveier vises bare når du faktisk har lagret eller besøkt noe.
                    </p>
                </div>

                <div className="grid min-w-0 gap-5 lg:grid-cols-2">
                    {favorites.length > 0 && (
                        <section aria-labelledby="favorites-title" className="min-w-0 overflow-hidden rounded-[28px] border border-slate-300 bg-white p-6 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.3)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_18px_45px_-36px_rgba(0,0,0,0.9)] md:p-7">
                            <div className="flex min-w-0 flex-col items-start gap-3 border-b border-slate-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                <div className="flex min-w-0 items-start gap-3 sm:items-center">
                                    <div className="rounded-xl bg-slate-100 p-2.5 text-blue-950 ring-1 ring-slate-200 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-400/20">
                                        <Star aria-hidden="true" className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 id="favorites-title" className="text-xl font-semibold text-slate-950 dark:text-white">Dine favoritter</h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-300">Hurtig tilgang til virksomheter du følger.</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={clearFavorites}
                                    aria-label="Tøm favoritter"
                                    className="text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-2 dark:text-slate-300 dark:hover:text-white dark:focus:ring-blue-300 dark:focus:ring-offset-slate-900"
                                >
                                    Tøm favoritter
                                </button>
                            </div>

                            <ul role="list" className="mt-5 min-w-0 space-y-3">
                                {favorites.slice(0, 6).map((company) => (
                                    <li key={company.orgnr} className="min-w-0">
                                        <Link
                                            to="/virksomhet/$orgnr"
                                            params={{ orgnr: company.orgnr }}
                                            className="flex min-w-0 items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 transition-colors hover:border-slate-400 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-900 sm:gap-4"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-base font-semibold text-slate-950 dark:text-white">{company.navn}</div>
                                                <div className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
                                                    {company.organisasjonsform || 'Virksomhet'} • {company.orgnr}
                                                </div>
                                            </div>
                                            <div className="shrink-0 whitespace-nowrap text-right text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                {formatDistanceToNow(company.addedAt)}
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {recentCompanies.length > 0 && (
                        <section aria-labelledby="recent-companies-title" className="min-w-0 overflow-hidden rounded-[28px] border border-slate-300 bg-white p-6 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.3)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_18px_45px_-36px_rgba(0,0,0,0.9)] md:p-7">
                            <div className="flex min-w-0 flex-col items-start gap-3 border-b border-slate-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                                <div className="flex min-w-0 items-start gap-3 sm:items-center">
                                    <div className="rounded-xl bg-slate-100 p-2.5 text-blue-950 ring-1 ring-slate-200 dark:bg-blue-500/15 dark:text-blue-200 dark:ring-blue-400/20">
                                        <Clock3 aria-hidden="true" className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 id="recent-companies-title" className="text-xl font-semibold text-slate-950 dark:text-white">Nylig besøkte virksomheter</h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-300">Bruk historikken for å gå raskt tilbake.</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={clearRecentCompanies}
                                    aria-label="Tøm historikk"
                                    className="text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-2 dark:text-slate-300 dark:hover:text-white dark:focus:ring-blue-300 dark:focus:ring-offset-slate-900"
                                >
                                    Tøm historikk
                                </button>
                            </div>

                            <ul role="list" className="mt-5 min-w-0 space-y-3">
                                {recentCompanies.slice(0, 6).map((company) => (
                                    <li key={company.orgnr} className="min-w-0">
                                        <Link
                                            to="/virksomhet/$orgnr"
                                            params={{ orgnr: company.orgnr }}
                                            className="flex min-w-0 items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 transition-colors hover:border-slate-400 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-900 sm:gap-4"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate text-base font-semibold text-slate-950 dark:text-white">{company.navn}</div>
                                                <div className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
                                                    {company.organisasjonsform || 'Virksomhet'} • {company.orgnr}
                                                </div>
                                            </div>
                                            <div className="shrink-0 whitespace-nowrap text-right text-xs font-semibold text-slate-600 dark:text-slate-300">
                                                {formatDistanceToNow(company.timestamp)}
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>
            </div>
        </section>
    )
}