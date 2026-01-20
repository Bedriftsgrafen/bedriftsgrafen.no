import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { Header } from '../components/layout'
import { Footer } from '../components/Footer'
import { NotFoundComponent } from '../components/NotFoundComponent'
import { ComparisonBar } from '../components/comparison'

import { GlobalErrorComponent } from '../components/GlobalErrorComponent'

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: GlobalErrorComponent,
})

function RootComponent() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900 font-sans">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <Outlet /> {/* Child routes render here */}
      </main>

      <Footer />

      {/* Comparison floating bar - visible on all pages */}
      <ComparisonBar />

      {/* DevTools only in development */}
      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </div>
  )
}
