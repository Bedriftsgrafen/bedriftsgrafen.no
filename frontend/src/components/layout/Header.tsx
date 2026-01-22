import { Search, AlertTriangle, Sparkles, BarChart3, Map, Info, Home, MapPin } from 'lucide-react'
import { Link, useRouterState } from '@tanstack/react-router'
import logo from '../../img/bg_logo_small.webp'

const navItems = [
  { to: '/', label: 'Hjem', icon: Home },
  { to: '/utforsk', label: 'Søk', icon: Search },
  { to: '/bransjer', label: 'Bransjer', icon: BarChart3 },
  { to: '/kart', label: 'Kart', icon: Map },
  { to: '/kommuner', label: 'Kommuner', icon: MapPin },
  { to: '/nyetableringer', label: 'Nyetableringer', icon: Sparkles },
  { to: '/konkurser', label: 'Konkurser', icon: AlertTriangle },
  { to: '/om', label: 'Om', icon: Info },
] as const

export function Header() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  return (
    <header className="gradient-noise text-white shadow-lg">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img
              src={logo}
              alt="Bedriftsgrafen Logo"
              width="50"
              height="50"
              className="h-10 w-auto drop-shadow-md"
            />
            <div className="hidden sm:block">
              <span className="text-xl font-bold tracking-tight text-white">
                Bedriftsgrafen.no
              </span>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => {
              const isActive = currentPath === to || (to !== '/' && currentPath.startsWith(to))
              return (
                <Link
                  key={to}
                  to={to}
                  aria-label={label}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive
                    ? 'bg-white/20 text-white'
                    : 'text-blue-100 hover:bg-white/10 hover:text-white'
                    }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden lg:inline">{label}</span>
                </Link>
              )
            })}
          </nav>
        </div>
      </div>
    </header>
  )
}

