import { lazy, Suspense, useEffect, useState } from 'react'

const HeroSearchPanel = lazy(() =>
    import('./HeroSearchPanel').then((mod) => ({ default: mod.HeroSearchPanel })),
)

type IdleSchedulerWindow = Window & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
    cancelIdleCallback?: (handle: number) => void
}

export function HeroSearch() {
    return (
        <section className="relative z-20 mb-10 pt-8 md:mb-14 md:pt-14">
            <div className="absolute inset-x-0 top-0 -z-10 h-105 bg-[radial-gradient(circle_at_top,rgba(37,99,235,0.12),transparent_58%)] dark:bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.28),transparent_62%)]" />
            <div className="mx-auto max-w-5xl px-4 sm:px-6">
                <div className="overflow-visible rounded-4xl border border-slate-300 bg-slate-50/95 px-5 py-8 shadow-[0_28px_70px_-42px_rgba(15,23,42,0.44)] transition-colors duration-300 dark:border-slate-700 dark:bg-slate-900/86 dark:shadow-[0_32px_90px_-42px_rgba(0,0,0,0.9)] sm:px-8 md:px-10 md:py-10">
                    <div className="mx-auto max-w-3xl text-center">
                        <p className="mx-auto mb-4 max-w-2xl text-xs font-semibold uppercase tracking-[0.28em] text-blue-800 dark:text-blue-300 sm:text-sm">
                            INNSIKT I NORSKE VIRKSOMHETER
                        </p>
                        <h1 id="hero-title" className="text-balance text-4xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-5xl md:text-[3.75rem] md:leading-[1.04]">
                            Finn og sammenlign norske virksomheter.
                        </h1>
                        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300 sm:text-xl">
                            Regnskap, nøkkeltall, roller og eierskap samlet i ett raskt søk.
                        </p>
                    </div>

                    <DeferredHeroSearchPanel />
                </div>
            </div>
        </section>
    )
}

function DeferredHeroSearchPanel() {
    const [shouldRender, setShouldRender] = useState(false)

    useEffect(() => {
        const idleWindow = window as IdleSchedulerWindow
        let idleHandle: number | undefined
        let didReveal = false
        const reveal = () => {
            if (didReveal) return
            didReveal = true
            setShouldRender(true)
        }

        const timeoutHandle = window.setTimeout(() => {
            if (idleWindow.requestIdleCallback) {
                idleHandle = idleWindow.requestIdleCallback(reveal, { timeout: 2400 })
                return
            }

            reveal()
        }, 2200)

        window.addEventListener('pointerdown', reveal, { once: true, passive: true })
        window.addEventListener('keydown', reveal, { once: true })

        return () => {
            window.clearTimeout(timeoutHandle)
            window.removeEventListener('pointerdown', reveal)
            window.removeEventListener('keydown', reveal)
            if (idleHandle !== undefined) {
                idleWindow.cancelIdleCallback?.(idleHandle)
            }
        }
    }, [])

    if (!shouldRender) return <HeroSearchPanelSkeleton />

    return (
        <Suspense fallback={<HeroSearchPanelSkeleton />}>
            <HeroSearchPanel />
        </Suspense>
    )
}

function HeroSearchPanelSkeleton() {
    return (
        <div
            aria-hidden="true"
            className="relative z-30 mx-auto mt-8 max-w-3xl rounded-[28px] border border-slate-300 bg-slate-100/80 p-3 shadow-[0_20px_45px_-34px_rgba(15,23,42,0.38)] dark:border-slate-700 dark:bg-slate-950/70 dark:shadow-[0_20px_45px_-34px_rgba(0,0,0,0.9)] sm:mt-10 sm:p-4 md:p-5"
        >
            <div className="mx-auto mb-4 grid w-full max-w-sm grid-cols-2 rounded-full bg-white p-1.5 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 sm:flex sm:w-auto sm:max-w-fit">
                <div className="h-10 rounded-full bg-blue-900 dark:bg-blue-500 sm:w-36" />
                <div className="h-10 rounded-full bg-slate-100 dark:bg-white/10 sm:w-30" />
            </div>
            <div className="rounded-2xl border border-slate-300 bg-slate-50 p-2.5 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.32)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_16px_36px_-28px_rgba(0,0,0,0.9)] sm:p-3 md:p-4">
                <div className="flex flex-col gap-3 md:flex-row">
                    <div className="h-13 flex-1 rounded-xl bg-white dark:bg-slate-800" />
                    <div className="h-13 rounded-xl bg-blue-900 dark:bg-blue-500 md:w-34" />
                </div>
            </div>
        </div>
    )
}