import { createLazyFileRoute } from '@tanstack/react-router'
import { CONTACT_EMAIL } from '../constants/contact'
import { Database, TrendingUp, Shield, Heart, Layout, Server, Cloud, Github } from 'lucide-react'
import { SEOHead } from '../components/layout'

export const Route = createLazyFileRoute('/om')({
    component: AboutPage,
})

function AboutPage() {
    return (
        <>
            <SEOHead
                title="Om Bedriftsgrafen.no - Norske bedriftsdata"
                description="Bedriftsgrafen.no gir deg gratis tilgang til offentlige data om norske bedrifter. Utforsk regnskap, nøkkeltall og finansiell informasjon."
            />

            <div className="max-w-4xl mx-auto">
                <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8">
                    <h1 className="text-3xl font-bold mb-6 text-gray-900">Om Bedriftsgrafen.no</h1>

                    <div className="space-y-6">
                        <p className="text-gray-700 leading-relaxed">
                            Bedriftsgrafen.no er et <strong>uavhengig hobbyprosjekt</strong> utviklet for å gjøre norske bedriftsdata
                            mer tilgjengelig og forståelig for alle. Vi henter åpne data fra Brønnøysundregistrene, SSB og Kartverket, og presenterer
                            dem i en brukervennlig visualisering.
                        </p>

                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <Database className="h-6 w-6 text-blue-600 shrink-0 mt-1" />
                                <div>
                                    <h2 className="font-semibold text-gray-900 mb-1">Åpne Data</h2>
                                    <p className="text-sm text-gray-600">
                                        All data hentes fra offentlige API-er. Vi lagrer og bearbeider
                                        informasjon for å tilby raske søk og historiske analyser.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <TrendingUp className="h-6 w-6 text-blue-600 shrink-0 mt-1" />
                                <div>
                                    <h2 className="font-semibold text-gray-900 mb-1">Finansielle Nøkkeltall</h2>
                                    <p className="text-sm text-gray-600">
                                        Vi beregner viktige nøkkeltall som likviditetsgrad, EBITDA, egenkapitalandel og
                                        lønnsomhetsmål basert på innsendte regnskapstall.
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <Shield className="h-6 w-6 text-blue-600 shrink-0 mt-1" />
                                <div>
                                    <h2 className="font-semibold text-gray-900 mb-1">Datakilder</h2>
                                    <p className="text-sm text-gray-600">
                                        <strong>Enhetsregisteret & Regnskapsregisteret:</strong> Bedriftsinformasjon og finansielle tall (Brønnøysundregistrene)
                                        <br />
                                        <strong>SSB:</strong> Statistikk, næringskoder og bransjestrukturer
                                        <br />
                                        <strong>Kartverket:</strong> Geografiske data og kartvisning
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <Github className="h-6 w-6 text-gray-900 shrink-0 mt-1" />
                                <div>
                                    <h2 className="font-semibold text-gray-900 mb-1">Åpen Kildekode</h2>
                                    <p className="text-sm text-gray-600 mb-3">
                                        Bedriftsgrafen er utviklet som åpen kildekode. Du kan utforske koden,
                                        bidra med forbedringer eller rapportere feil på vår GitHub-side.
                                    </p>
                                    <div className="flex flex-wrap gap-3">
                                        <a
                                            href="https://github.com/Bedriftsgrafen/bedriftsgrafen.no"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-md transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md border border-gray-900 hover:ring-2 hover:ring-gray-900 hover:ring-offset-1"
                                        >
                                            Se på GitHub
                                        </a>
                                        <a
                                            href="https://codewiki.google/github.com/bedriftsgrafen/bedriftsgrafen.no"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 text-sm font-medium rounded-md transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md border border-blue-200 hover:ring-2 hover:ring-blue-200 hover:ring-offset-1"
                                        >
                                            CodeWiki
                                        </a>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <Heart className="h-6 w-6 text-red-500 shrink-0 mt-1" />
                                <div>
                                    <h2 className="font-semibold text-gray-900 mb-1">Støtt oss</h2>
                                    <p className="text-sm text-gray-600 mb-3">
                                        Liker du prosjektet? Vurder å støtte videre utvikling og drift:
                                    </p>
                                    <div className="flex flex-wrap gap-3">
                                        <a
                                            href="https://patreon.com/bedriftsgrafen"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-800 text-sm font-medium rounded-md transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md border border-orange-200 hover:ring-2 hover:ring-orange-200 hover:ring-offset-1"
                                        >
                                            Patreon
                                        </a>
                                        <a
                                            href="https://ko-fi.com/bedriftsgrafen"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 text-sm font-medium rounded-md transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md border border-blue-200 hover:ring-2 hover:ring-blue-200 hover:ring-offset-1"
                                        >
                                            Ko-fi
                                        </a>
                                        <span className="text-gray-400">•</span>
                                        <a
                                            href="https://no.linkedin.com/in/ken-solbakken-remen-3ab62252"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 text-sm font-medium rounded-md transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md border border-blue-200 hover:ring-2 hover:ring-blue-200 hover:ring-offset-1"
                                        >
                                            LinkedIn
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                            <p className="text-sm text-gray-700">
                                <strong>Tips:</strong> Bruk hurtigtaster for en bedre opplevelse:
                            </p>
                            <ul className="text-sm text-gray-600 mt-2 space-y-1">
                                <li>• <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono">/</kbd> for å fokusere søkefeltet</li>
                                <li>• <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs font-mono">Esc</kbd> for å lukke modaler</li>
                            </ul>
                        </div>

                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                            <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                Teknisk arkitektur
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                    <div className="bg-blue-50 w-10 h-10 rounded-lg flex items-center justify-center mb-3">
                                        <Layout className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <h3 className="font-semibold text-gray-900 text-sm mb-1">Frontend</h3>
                                    <p className="text-xs text-gray-600 leading-tight">
                                        React, TypeScript, TanStack Router & Query
                                    </p>
                                </div>

                                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                    <div className="bg-emerald-50 w-10 h-10 rounded-lg flex items-center justify-center mb-3">
                                        <Server className="h-5 w-5 text-emerald-600" />
                                    </div>
                                    <h3 className="font-semibold text-gray-900 text-sm mb-1">Backend</h3>
                                    <p className="text-xs text-gray-600 leading-tight">
                                        Python FastAPI & PostgreSQL
                                    </p>
                                </div>

                                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                                    <div className="bg-purple-50 w-10 h-10 rounded-lg flex items-center justify-center mb-3">
                                        <Cloud className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <h3 className="font-semibold text-gray-900 text-sm mb-1">Hosting</h3>
                                    <p className="text-xs text-gray-600 leading-tight">
                                        Docker & Nginx Proxy Manager på egen maskinvare
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-200 pt-6">
                            <p className="text-sm text-gray-700">
                                Har du spørsmål eller tilbakemeldinger? Send en e-post til{' '}
                                <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline font-medium">
                                    {CONTACT_EMAIL}
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )
}
