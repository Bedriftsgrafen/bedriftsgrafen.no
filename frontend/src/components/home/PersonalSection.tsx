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
        <section aria-labelledby="personal-section-title" className="mb-10 px-4 sm:px-6 md:mb-14">
            <div className="mx-auto max-w-6xl">
                <div className="mb-6">
                    <h2 id="personal-section-title" className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                        Fortsett der du slapp
                    </h2>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                        Personlige snarveier vises bare når du faktisk har lagret eller besøkt noe.
                    </p>
                </div>

                <div className="grid gap-5 lg:grid-cols-2">
                    {favorites.length > 0 && (
                        <section aria-labelledby="favorites-title" className="rounded-[28px] border border-slate-300 bg-white p-6 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.3)] md:p-7">
                            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl bg-slate-100 p-2.5 text-blue-950 ring-1 ring-slate-200">
                                        <Star aria-hidden="true" className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h3 id="favorites-title" className="text-xl font-semibold text-slate-950">Dine favoritter</h3>
                                        <p className="text-sm text-slate-500">Hurtig tilgang til virksomheter du følger.</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={clearFavorites}
                                    aria-label="Tøm favoritter"
                                    className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-2"
                                >
                                    Tøm favoritter
                                </button>
                            </div>

                            <ul role="list" className="mt-5 space-y-3">
                                {favorites.slice(0, 6).map((company) => (
                                    <li key={company.orgnr}>
                                        <Link
                                            to="/virksomhet/$orgnr"
                                            params={{ orgnr: company.orgnr }}
                                            className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 transition-colors hover:border-slate-400 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2"
                                        >
                                            <div className="min-w-0">
                                                <div className="truncate text-base font-semibold text-slate-950">{company.navn}</div>
                                                <div className="mt-1 text-sm text-slate-500">
                                                    {company.organisasjonsform || 'Virksomhet'} • {company.orgnr}
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-xs font-medium text-slate-400">
                                                {formatDistanceToNow(company.addedAt)}
                                            </div>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {recentCompanies.length > 0 && (
                        <section aria-labelledby="recent-companies-title" className="rounded-[28px] border border-slate-300 bg-white p-6 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.3)] md:p-7">
                            <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-5">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-xl bg-slate-100 p-2.5 text-blue-950 ring-1 ring-slate-200">
                                        <Clock3 aria-hidden="true" className="h-4 w-4" />
                                    </div>
                                    <div>
                                        <h3 id="recent-companies-title" className="text-xl font-semibold text-slate-950">Nylig besøkte virksomheter</h3>
                                        <p className="text-sm text-slate-500">Bruk historikken for å gå raskt tilbake.</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={clearRecentCompanies}
                                    aria-label="Tøm historikk"
                                    className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:ring-offset-2"
                                >
                                    Tøm historikk
                                </button>
                            </div>

                            <ul role="list" className="mt-5 space-y-3">
                                {recentCompanies.slice(0, 6).map((company) => (
                                    <li key={company.orgnr}>
                                        <Link
                                            to="/virksomhet/$orgnr"
                                            params={{ orgnr: company.orgnr }}
                                            className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50/50 px-4 py-3.5 transition-colors hover:border-slate-400 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2"
                                        >
                                            <div className="min-w-0">
                                                <div className="truncate text-base font-semibold text-slate-950">{company.navn}</div>
                                                <div className="mt-1 text-sm text-slate-500">
                                                    {company.organisasjonsform || 'Virksomhet'} • {company.orgnr}
                                                </div>
                                            </div>
                                            <div className="shrink-0 text-xs font-medium text-slate-400">
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