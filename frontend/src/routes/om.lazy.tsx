/* eslint-disable react-refresh/only-export-components */
import { createLazyFileRoute } from '@tanstack/react-router'
import { Database, TrendingUp, Shield, Heart, Layout, Server, Cloud } from 'lucide-react'
import { SEOHead } from '../components/layout'
import { BedriftsgrafenContactLink } from '../components/contact'

export const Route = createLazyFileRoute('/om')({
    component: AboutPage,
})

function AboutPage() {
    return (
        <>
            <SEOHead
                title="Om Bedriftsgrafen.no - Norske virksomhetsdata"
                description="Bedriftsgrafen.no gir deg gratis tilgang til offentlige data om norske virksomheter. Utforsk regnskap, nøkkeltall og finansiell informasjon."
            />

            <div className="mx-auto max-w-4xl">
                <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-md dark:border-slate-800 dark:bg-slate-900 md:p-8">
                    <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">Om Bedriftsgrafen.no</h1>

                    <div className="space-y-6">
                        <p className="leading-relaxed text-gray-700 dark:text-slate-300">
                            Bedriftsgrafen.no er et <strong>uavhengig hobbyprosjekt</strong> utviklet for å gjøre norske virksomhetsdata
                            mer tilgjengelig og forståelig for alle. Vi henter åpne data fra Brønnøysundregistrene, SSB og Kartverket, og presenterer
                            dem i en brukervennlig visualisering.
                        </p>

                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <Database className="mt-1 h-6 w-6 shrink-0 text-blue-600 dark:text-blue-300" />
                                <div>
                                    <h2 className="mb-1 font-semibold text-gray-900 dark:text-white">Åpne Data</h2>
                                    <p className="text-sm text-gray-600 dark:text-slate-300">
                                        All data hentes fra offentlige API-er. Vi lagrer og bearbeider
                                        informasjon for å tilby raske søk og historiske analyser.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <TrendingUp className="mt-1 h-6 w-6 shrink-0 text-blue-600 dark:text-blue-300" />
                                <div>
                                    <h2 className="mb-1 font-semibold text-gray-900 dark:text-white">Finansielle Nøkkeltall</h2>
                                    <p className="text-sm text-gray-600 dark:text-slate-300">
                                        Vi beregner viktige nøkkeltall som likviditetsgrad, EBITDA, egenkapitalandel og
                                        lønnsomhetsmål basert på innsendte regnskapstall.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <Shield className="mt-1 h-6 w-6 shrink-0 text-blue-600 dark:text-blue-300" />
                                <div>
                                    <h2 className="mb-1 font-semibold text-gray-900 dark:text-white">Datakilder</h2>
                                    <p className="text-sm text-gray-600 dark:text-slate-300">
                                        <strong>Enhetsregisteret & Regnskapsregisteret:</strong> Virksomhetsinformasjon og finansielle tall (Brønnøysundregistrene)
                                        <br />
                                        <strong>SSB:</strong> Statistikk, næringskoder og bransjestrukturer
                                        <br />
                                        <strong>Kartverket:</strong> Geografiske data og kartvisning
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center">
                                    <svg className="h-6 w-6 fill-current text-gray-900 dark:text-white" viewBox="0 0 24 24">
                                        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.63-.33 2.47-.33.84 0 1.68.11 2.47.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 className="mb-1 font-semibold text-gray-900 dark:text-white">Åpen Kildekode</h2>
                                    <p className="mb-3 text-sm text-gray-600 dark:text-slate-300">
                                        Bedriftsgrafen er utviklet som åpen kildekode. Du kan utforske koden,
                                        bidra med forbedringer eller rapportere feil på vår GitHub-side.
                                    </p>
                                    <div className="flex flex-wrap gap-3">
                                        <a
                                            href="https://github.com/Bedriftsgrafen/bedriftsgrafen.no"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center rounded-md border border-gray-900 bg-gray-900 px-3 py-1.5 text-sm font-medium text-white transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-gray-800 hover:shadow-md hover:ring-2 hover:ring-gray-900 hover:ring-offset-1 dark:border-slate-600 dark:bg-slate-950 dark:hover:bg-slate-800 dark:hover:ring-slate-600 dark:hover:ring-offset-slate-900"
                                        >
                                            Se på GitHub
                                        </a>
                                        <a
                                            href="https://codewiki.google/github.com/bedriftsgrafen/bedriftsgrafen.no"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-800 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-blue-100 hover:shadow-md hover:ring-2 hover:ring-blue-200 hover:ring-offset-1 dark:border-blue-400/25 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20 dark:hover:ring-blue-400/30 dark:hover:ring-offset-slate-900"
                                        >
                                            CodeWiki
                                        </a>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <Heart className="mt-1 h-6 w-6 shrink-0 text-red-500 dark:text-red-300" />
                                <div>
                                    <h2 className="mb-1 font-semibold text-gray-900 dark:text-white">Støtt oss</h2>
                                    <p className="mb-3 text-sm text-gray-600 dark:text-slate-300">
                                        Liker du prosjektet? Vurder å støtte videre utvikling og drift:
                                    </p>
                                    <div className="flex flex-wrap gap-3">
                                        <a
                                            href="https://patreon.com/bedriftsgrafen"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center rounded-md border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-800 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-orange-100 hover:shadow-md hover:ring-2 hover:ring-orange-200 hover:ring-offset-1 dark:border-orange-300/25 dark:bg-orange-500/10 dark:text-orange-200 dark:hover:bg-orange-500/20 dark:hover:ring-orange-300/30 dark:hover:ring-offset-slate-900"
                                        >
                                            Patreon
                                        </a>
                                        <a
                                            href="https://ko-fi.com/bedriftsgrafen"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-800 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-blue-100 hover:shadow-md hover:ring-2 hover:ring-blue-200 hover:ring-offset-1 dark:border-blue-400/25 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20 dark:hover:ring-blue-400/30 dark:hover:ring-offset-slate-900"
                                        >
                                            Ko-fi
                                        </a>
                                        <span className="text-gray-400 dark:text-slate-300">•</span>
                                        <a
                                            href="https://no.linkedin.com/in/ken-solbakken-remen-3ab62252"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-800 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:bg-blue-100 hover:shadow-md hover:ring-2 hover:ring-blue-200 hover:ring-offset-1 dark:border-blue-400/25 dark:bg-blue-500/10 dark:text-blue-200 dark:hover:bg-blue-500/20 dark:hover:ring-blue-400/30 dark:hover:ring-offset-slate-900"
                                        >
                                            LinkedIn
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 dark:border-blue-400/25 dark:bg-blue-500/10">
                            <p className="text-sm text-gray-700 dark:text-slate-100">
                                <strong>Tips:</strong> Bruk hurtigtaster for en bedre opplevelse:
                            </p>
                            <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-slate-300">
                                <li>• <kbd className="rounded border border-gray-300 bg-white px-2 py-1 font-mono text-xs text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">/</kbd> for å fokusere søkefeltet</li>
                                <li>• <kbd className="rounded border border-gray-300 bg-white px-2 py-1 font-mono text-xs text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">Esc</kbd> for å lukke modaler</li>
                            </ul>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-slate-800 dark:bg-slate-950/60">
                            <h2 className="mb-4 flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                                Teknisk arkitektur
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10">
                                        <Layout className="h-5 w-5 text-blue-600 dark:text-blue-300" />
                                    </div>
                                    <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">Frontend</h3>
                                    <p className="text-xs leading-tight text-gray-600 dark:text-slate-300">
                                        React, TypeScript, TanStack Router & Query
                                    </p>
                                </div>

                                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                                        <Server className="h-5 w-5 text-emerald-600 dark:text-emerald-300" />
                                    </div>
                                    <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">Backend</h3>
                                    <p className="text-xs leading-tight text-gray-600 dark:text-slate-300">
                                        Python FastAPI & PostgreSQL
                                    </p>
                                </div>

                                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 dark:bg-violet-500/10">
                                        <Cloud className="h-5 w-5 text-purple-600 dark:text-violet-300" />
                                    </div>
                                    <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">Hosting</h3>
                                    <p className="text-xs leading-tight text-gray-600 dark:text-slate-300">
                                        Docker & Nginx Proxy Manager på egen maskinvare
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-200 pt-6 dark:border-slate-800">
                            <p className="text-sm leading-6 text-gray-700 dark:text-slate-300">
                                Har du spørsmål eller tilbakemeldinger om Bedriftsgrafen.no?{' '}
                                <BedriftsgrafenContactLink className="font-medium text-blue-600 hover:underline dark:text-blue-300">
                                    Send e-post om nettsiden
                                </BedriftsgrafenContactLink>
                                . Ikke bruk dette for å kontakte virksomheter eller personer omtalt på siden.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
