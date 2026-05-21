/* eslint-disable react-refresh/only-export-components */
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Header } from '../components/layout'
import { NotFoundComponent } from '../components/NotFoundComponent'
import { GlobalErrorComponent } from '../components/GlobalErrorComponent'
import { useOnlineStatus } from '../hooks/useOnlineStatus'

// Lazy-load devtools so they are fully tree-shaken in production
const TanStackRouterDevtools = import.meta.env.PROD
  ? () => null
  : lazy(() =>
      import('@tanstack/router-devtools').then((mod) => ({
        default: mod.TanStackRouterDevtools,
      })),
    )

const Footer = lazy(() =>
  import('../components/Footer').then((mod) => ({ default: mod.Footer })),
)

const GlobalAffiliateStrip = lazy(() =>
  import('../components/ads/GlobalAffiliateStrip').then((mod) => ({ default: mod.GlobalAffiliateStrip })),
)

const ComparisonBar = lazy(() =>
  import('../components/comparison/ComparisonBar').then((mod) => ({ default: mod.ComparisonBar })),
)

type IdleSchedulerWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: GlobalErrorComponent,
})

function RootComponent() {
  const isOnline = useOnlineStatus()

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-gray-50 font-sans text-gray-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100">
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="bg-yellow-400 px-4 py-2 text-center text-sm font-medium text-yellow-950 dark:bg-amber-500 dark:text-slate-950"
        >
          Du er frakoblet. Endringer blir ikke lagret.
        </div>
      )}
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-full">
        <Outlet /> {/* Child routes render here */}
      </main>

      <DeferredRootExtras />

      {/* DevTools only in development */}
      {!import.meta.env.PROD && (
        <Suspense fallback={null}>
          <TanStackRouterDevtools position="bottom-right" />
        </Suspense>
      )}
    </div>
  )
}

function DeferredRootExtras() {
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
    }, 3200)

    return () => {
      window.clearTimeout(timeoutHandle)
      if (idleHandle !== undefined) {
        idleWindow.cancelIdleCallback?.(idleHandle)
      }
    }
  }, [])

  if (!shouldRender) return null

  return (
    <Suspense fallback={null}>
      <GlobalAffiliateStrip />
      <Footer />
      <ComparisonBar />
    </Suspense>
  )
}
