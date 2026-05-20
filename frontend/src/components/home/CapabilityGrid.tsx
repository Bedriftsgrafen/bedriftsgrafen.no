import { Link } from '@tanstack/react-router'
import { ArrowRight, BarChart3, Globe, MapPin, Users } from 'lucide-react'
import type { ComponentType } from 'react'

interface CapabilityCard {
    title: string
    description: string
    to: '/bransjer' | '/kart' | '/person' | '/regioner'
    icon: ComponentType<{ className?: string }>
}

const CAPABILITIES: CapabilityCard[] = [
    {
        title: 'Personer',
        description: 'Finn roller, verv og tilknytninger på tvers av selskaper.',
        to: '/person',
        icon: Users,
    },
    {
        title: 'Bransjer',
        description: 'Sammenlign næringer på omsetning, marginer og soliditet.',
        to: '/bransjer',
        icon: BarChart3,
    },
    {
        title: 'Kart',
        description: 'Se geografisk fordeling og finn virksomheter i ditt område.',
        to: '/kart',
        icon: MapPin,
    },
    {
        title: 'Regioner',
        description: 'Utforsk fylker, kommuner og regionale mønstre i næringslivet.',
        to: '/regioner',
        icon: Globe,
    },
]

export function CapabilityGrid() {
    return (
        <section aria-labelledby="capability-grid-title" className="mb-10 px-4 sm:px-6 md:mb-14">
            <div className="mx-auto max-w-6xl">
                <div className="mb-6 md:mb-7">
                    <h2 id="capability-grid-title" className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                        Utforsk næringslivet fra flere vinkler
                    </h2>
                    <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                        Gå rett til bransjer, kart eller rolleanalyse.
                    </p>
                </div>

                <ul role="list" className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-4">
                    {CAPABILITIES.map((capability) => {
                        const Icon = capability.icon
                        const capabilityId = capability.title.toLowerCase().replace(/\s+/g, '-')

                        return (
                            <li key={capability.title} className="flex">
                                <Link
                                    to={capability.to}
                                    aria-labelledby={`${capabilityId}-title`}
                                    aria-describedby={`${capabilityId}-description`}
                                    className="group flex min-h-64 w-full flex-col rounded-[26px] border border-slate-300 bg-slate-50 p-6 shadow-[0_18px_45px_-36px_rgba(15,23,42,0.34)] transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white hover:shadow-[0_22px_55px_-34px_rgba(15,23,42,0.38)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 md:p-7"
                                >
                                    <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-blue-950 ring-1 ring-slate-200">
                                        <Icon aria-hidden="true" className="h-5 w-5" />
                                    </div>
                                    <h3 id={`${capabilityId}-title`} className="text-xl font-semibold text-slate-950">
                                        {capability.title}
                                    </h3>
                                    <p id={`${capabilityId}-description`} className="mt-3 text-base leading-7 text-slate-600">
                                        {capability.description}
                                    </p>
                                    <div aria-hidden="true" className="mt-auto inline-flex items-center gap-2 pt-7 text-sm font-semibold text-blue-900">
                                        Åpne
                                        <ArrowRight className="h-4 w-4" />
                                    </div>
                                </Link>
                            </li>
                        )
                    })}
                </ul>
            </div>
        </section>
    )
}