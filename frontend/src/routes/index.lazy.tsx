/* eslint-disable react-refresh/only-export-components */
import { createLazyFileRoute } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useState } from 'react'
import { SEOHead } from '../components/layout'
import { HeroSearch } from '../components/home/HeroSearch'

const TrustMetrics = lazy(() =>
    import('../components/home/TrustMetrics').then((mod) => ({ default: mod.TrustMetrics })),
)

const CapabilityGrid = lazy(() =>
    import('../components/home/CapabilityGrid').then((mod) => ({ default: mod.CapabilityGrid })),
)

const LiveDataPanel = lazy(() =>
    import('../components/home/LiveDataPanel').then((mod) => ({ default: mod.LiveDataPanel })),
)

const PersonalSection = lazy(() =>
    import('../components/home/PersonalSection').then((mod) => ({ default: mod.PersonalSection })),
)

type IdleSchedulerWindow = Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
    cancelIdleCallback?: (handle: number) => void
}

export const Route = createLazyFileRoute('/')(
    {
        component: HomePage,
    })

export function HomePage() {
    return (
        <div className="-mx-4 -my-8 bg-[linear-gradient(180deg,#eef3f8_0%,#f6f8fb_24%,#edf2f7_100%)] px-4 py-8 transition-colors duration-300 dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_42%,#020617_100%)] [&>section:last-of-type]:mb-0">
            <SEOHead />
            <HeroSearch />
            <DeferredHomeSections />
        </div>
    )
}

function DeferredHomeSections() {
    const [shouldRender, setShouldRender] = useState(false)

    useEffect(() => {
        const idleWindow = window as IdleSchedulerWindow
        let idleHandle: number | undefined
        const timeoutHandle = window.setTimeout(() => {
            if (idleWindow.requestIdleCallback) {
                idleHandle = idleWindow.requestIdleCallback(() => setShouldRender(true), { timeout: 2200 })
                return
            }

            setShouldRender(true)
        }, 1800)

        return () => {
            window.clearTimeout(timeoutHandle)
            if (idleHandle !== undefined) {
                idleWindow.cancelIdleCallback?.(idleHandle)
            }
        }
    }, [])

    if (!shouldRender) return <HomeSectionsSkeleton />

    return (
        <Suspense fallback={<HomeSectionsSkeleton />}>
            <TrustMetrics />
            <CapabilityGrid />
            <LiveDataPanel />
            <PersonalSection />
        </Suspense>
    )
}

function HomeSectionsSkeleton() {
    return (
        <div aria-hidden="true" className="mx-auto mt-6 grid w-full max-w-6xl grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
                <div
                    key={index}
                    className="min-h-28 rounded-lg border border-white/80 bg-white/70 shadow-sm dark:border-slate-700/70 dark:bg-slate-900/70"
                />
            ))}
        </div>
    )
}
