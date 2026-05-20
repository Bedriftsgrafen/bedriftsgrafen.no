/* eslint-disable react-refresh/only-export-components */
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { Header } from '../components/layout'
import { Footer } from '../components/Footer'
import { NotFoundComponent } from '../components/NotFoundComponent'
import { ComparisonBar } from '../components/comparison'
import { GlobalAffiliateStrip } from '../components/ads/GlobalAffiliateStrip'
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

      <GlobalAffiliateStrip />
      <Footer />

      {/* Comparison floating bar - visible on all pages */}
      <ComparisonBar />

      {/* DevTools only in development */}
      {!import.meta.env.PROD && (
        <Suspense fallback={null}>
          <TanStackRouterDevtools position="bottom-right" />
        </Suspense>
      )}
    </div>
  )
}
