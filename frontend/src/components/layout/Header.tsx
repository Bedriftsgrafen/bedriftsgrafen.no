import { Building2, AlertTriangle, Sparkles, BarChart3, Map, Info, Home, Globe, Users } from 'lucide-react'
import { Link, useRouterState } from '@tanstack/react-router'
import { ThemeToggle } from '../common/ThemeToggle'
import logo from '../../img/bg_logo_small.webp'

const navItems = [
  { to: '/', label: 'Hjem', icon: Home },
  { to: '/utforsk', label: 'Virksomheter', icon: Building2 },
  { to: '/person', label: 'Personer', icon: Users },
  { to: '/bransjer', label: 'Bransjer', icon: BarChart3 },
  { to: '/kart', label: 'Kart', icon: Map },
  { to: '/regioner', label: 'Regioner', icon: Globe },
  { to: '/nyetableringer', label: 'Nyetableringer', shortLabel: 'Nye', icon: Sparkles },
  { to: '/konkurser', label: 'Konkurser', icon: AlertTriangle },
  { to: '/om', label: 'Om', icon: Info },
] as const

export function Header() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  return (
    <header className="border-b border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] text-slate-900 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.24)] backdrop-blur transition-colors duration-300 dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,0.94))] dark:text-slate-100 dark:shadow-[0_18px_40px_-32px_rgba(0,0,0,0.7)]">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <Link
            to="/"
            aria-label="Bedriftsgrafen.no"
            className="group inline-flex items-center gap-3 rounded-2xl transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-950"
          >
            <img
              src={logo}
              alt=""
              aria-hidden="true"
              width="40"
              height="40"
              className="h-11 w-11 shrink-0 rounded-xl ring-1 ring-slate-200 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.26)] transition-transform group-hover:scale-[1.02] dark:ring-white/15 dark:shadow-[0_12px_24px_-18px_rgba(0,0,0,0.7)]"
            />
            <div className="hidden sm:block">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">
                Norske virksomheter
              </span>
              <span className="block text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
                Bedriftsgrafen.no
              </span>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-2 xl:justify-end">
            <nav aria-label="Hovednavigasjon" className="flex flex-wrap items-center gap-1.5 xl:justify-end">
              {navItems.map((item) => {
                const { to, label, icon: Icon } = item
                const visibleLabel = 'shortLabel' in item ? item.shortLabel : label
                const isRegionRoute = to === '/regioner' && (
                  currentPath.startsWith('/regioner') ||
                  currentPath.startsWith('/fylker') ||
                  currentPath.startsWith('/fylke/') ||
                  currentPath.startsWith('/kommuner') ||
                  currentPath.startsWith('/kommune/')
                )
                const isActive = currentPath === to || (to !== '/' && currentPath.startsWith(to)) || isRegionRoute
                return (
                  <Link
                    key={to}
                    to={to}
                    aria-label={label}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-950 ${isActive
                      ? 'bg-blue-900 text-white shadow-[0_12px_24px_-18px_rgba(30,58,138,0.55)] hover:bg-blue-800 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400'
                      : 'text-slate-600 hover:bg-blue-50 hover:text-blue-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
                      }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden lg:inline">{visibleLabel}</span>
                  </Link>
                )
              })}
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  )
}

