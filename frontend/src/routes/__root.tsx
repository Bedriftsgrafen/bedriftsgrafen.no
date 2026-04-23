/* eslint-disable react-refresh/only-export-components */
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
import { Header } from '../components/layout'
import { Footer } from '../components/Footer'
import { NotFoundComponent } from '../components/NotFoundComponent'
import { ComparisonBar } from '../components/comparison'
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
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900 font-sans overflow-x-hidden">
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="bg-yellow-400 text-yellow-900 text-sm font-medium text-center py-2 px-4"
        >
          Du er frakoblet. Endringer blir ikke lagret.
        </div>
      )}
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-full">
        <Outlet /> {/* Child routes render here */}
      </main>

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
