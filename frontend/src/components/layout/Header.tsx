import { Menu, X } from 'lucide-react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ThemeToggle } from '../common/ThemeToggle'
import logo from '../../img/bg_logo_small.webp'
import { useComparisonCount } from '../../store/comparisonStore'
import { HeaderNavLink, HeaderQuickMenu } from './HeaderQuickMenu'
import {
  HEADER_MOBILE_SHORTCUT_ITEMS,
  HEADER_QUICK_MENU_GROUPS,
  HEADER_TOP_NAV_ITEMS,
  HEADER_UTILITY_NAV_ITEMS,
  isHeaderPrimaryNavItemActive,
  type HeaderLocationSearch,
  type HeaderNavItem,
} from './headerNav'

const MENU_ID = 'header-quick-menu'

function getShortcutClassName(item: HeaderNavItem, isActive: boolean): string {
  const visibilityClass = item.id === 'compare' ? 'hidden md:inline-flex lg:hidden' : 'inline-flex lg:hidden'

  return `${visibilityClass} relative h-11 w-11 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-950 ${isActive
    ? 'bg-blue-900 text-white shadow-[0_12px_24px_-20px_rgba(30,58,138,0.65)] hover:bg-blue-800 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400'
    : 'text-slate-600 hover:bg-blue-50 hover:text-blue-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
    }`
}

function getTopNavClassName(item: HeaderNavItem, isActive: boolean): string {
  const responsiveSizeClass = item.topBar === 'xl' ? 'w-11 px-0 xl:w-auto xl:px-3' : 'px-3'

  return `relative hidden h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-950 lg:inline-flex ${responsiveSizeClass} ${isActive
    ? 'bg-blue-900 text-white shadow-[0_12px_24px_-20px_rgba(30,58,138,0.65)] hover:bg-blue-800 dark:bg-blue-500 dark:text-slate-950 dark:hover:bg-blue-400'
    : 'text-slate-600 hover:bg-blue-50 hover:text-blue-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white'
    }`
}

function getHeaderItemAriaLabel(item: HeaderNavItem, comparisonCount: number): string {
  if (item.id !== 'compare' || comparisonCount === 0) return item.label
  return `${item.label} (${comparisonCount} valgt)`
}

function HeaderComparisonBadge({ count, inline = false }: { count: number; inline?: boolean }) {
  if (count === 0) return null

  return (
    <span
      aria-hidden="true"
      className={inline
        ? 'ml-auto inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-900 px-1.5 text-[11px] font-black tabular-nums text-white dark:bg-blue-400 dark:text-slate-950'
        : 'absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-white bg-blue-900 px-1.5 text-[11px] font-black tabular-nums leading-none text-white shadow-sm dark:border-slate-950 dark:bg-blue-400 dark:text-slate-950'
      }
    >
      {count}
    </span>
  )
}

export function Header() {
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname
  const currentSearch = routerState.location.search as HeaderLocationSearch
  const currentHref = routerState.location.href

  return <HeaderContent key={currentHref} currentPath={currentPath} currentSearch={currentSearch} />
}

type HeaderContentProps = {
  currentPath: string
  currentSearch: HeaderLocationSearch
}

function HeaderContent({ currentPath, currentSearch }: HeaderContentProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const headerRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const comparisonCount = useComparisonCount()

  const closeMenu = useCallback((restoreFocus = false) => {
    setIsMenuOpen(false)
    if (restoreFocus) {
      menuButtonRef.current?.focus()
    }
  }, [])

  useEffect(() => {
    if (!isMenuOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (!headerRef.current?.contains(event.target)) {
        closeMenu()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMenu(true)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeMenu, isMenuOpen])

  return (
    <header className="relative z-2000 border-b border-slate-200/90 bg-white/95 text-slate-900 shadow-[0_12px_30px_-28px_rgba(15,23,42,0.35)] backdrop-blur transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-100 dark:shadow-black/20">
      <div ref={headerRef} className="relative mx-auto max-w-7xl px-3 py-1 sm:px-6">
        <div className="flex min-h-12 min-w-0 items-center justify-between gap-2 lg:min-h-14">
          <Link
            to="/"
            aria-label="Bedriftsgrafen.no"
            className="group inline-flex min-w-0 shrink items-center gap-3 rounded-xl transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-950"
          >
            <img
              src={logo}
              alt=""
              aria-hidden="true"
              width="40"
              height="40"
              className="h-10 w-10 shrink-0 rounded-xl ring-1 ring-slate-200 shadow-[0_12px_24px_-20px_rgba(15,23,42,0.26)] transition-transform group-hover:scale-[1.02] dark:ring-white/15 dark:shadow-black/20 lg:h-11 lg:w-11"
            />
            <div className="hidden min-w-0 sm:block">
              <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700 dark:text-blue-300">
                Norske virksomheter
              </span>
              <span className="block truncate text-lg font-semibold tracking-tight text-slate-950 dark:text-white lg:text-xl">
                Bedriftsgrafen.no
              </span>
            </div>
          </Link>

          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5 sm:gap-2">
            {HEADER_MOBILE_SHORTCUT_ITEMS.map((item) => {
              const Icon = item.icon
              const isActive = isHeaderPrimaryNavItemActive(currentPath, currentSearch, item)

              return (
                <HeaderNavLink
                  key={`shortcut-${item.id}`}
                  item={item}
                  isActive={isActive}
                  ariaLabel={getHeaderItemAriaLabel(item, comparisonCount)}
                  className={getShortcutClassName(item, isActive)}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.id === 'compare' && <HeaderComparisonBadge count={comparisonCount} />}
                </HeaderNavLink>
              )
            })}

            <nav aria-label="Hovednavigasjon" className="hidden min-w-0 items-center gap-1 lg:flex">
              {HEADER_TOP_NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const isActive = isHeaderPrimaryNavItemActive(currentPath, currentSearch, item)

                return (
                  <HeaderNavLink
                    key={item.id}
                    item={item}
                    isActive={isActive}
                    ariaLabel={getHeaderItemAriaLabel(item, comparisonCount)}
                    className={getTopNavClassName(item, isActive)}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className={item.topBar === 'xl' ? 'hidden xl:inline' : undefined}>{item.topLabel ?? item.label}</span>
                  </HeaderNavLink>
                )
              })}
              {HEADER_UTILITY_NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const isActive = isHeaderPrimaryNavItemActive(currentPath, currentSearch, item)

                return (
                  <HeaderNavLink
                    key={item.id}
                    item={item}
                    isActive={isActive}
                    ariaLabel={getHeaderItemAriaLabel(item, comparisonCount)}
                    className={getTopNavClassName(item, isActive)}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>{item.topLabel ?? item.label}</span>
                    {item.id === 'compare' && <HeaderComparisonBadge count={comparisonCount} inline />}
                  </HeaderNavLink>
                )
              })}
            </nav>

            <ThemeToggle compact />

            <button
              ref={menuButtonRef}
              type="button"
              aria-label={isMenuOpen ? 'Lukk meny' : 'Åpne meny'}
              aria-expanded={isMenuOpen}
              aria-controls={MENU_ID}
              onClick={() => setIsMenuOpen((open) => !open)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white/75 px-3 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-950"
            >
              {isMenuOpen ? (
                <X className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Menu className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{isMenuOpen ? 'Lukk' : 'Meny'}</span>
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <HeaderQuickMenu
            id={MENU_ID}
            groups={HEADER_QUICK_MENU_GROUPS}
            pathname={currentPath}
            search={currentSearch}
            comparisonCount={comparisonCount}
            onNavigate={() => closeMenu()}
          />
        )}
      </div>
    </header>
  )
}

