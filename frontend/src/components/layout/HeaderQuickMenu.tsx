import type { AriaAttributes, ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {
  getHeaderItemHref,
  isHeaderNavItemActive,
  type HeaderLocationSearch,
  type HeaderNavGroup,
  type HeaderNavItem,
} from './headerNav'

type HeaderNavLinkProps = {
  item: HeaderNavItem
  children: ReactNode
  className: string
  isActive?: boolean
  ariaLabel?: string
  onNavigate?: () => void
}

export function HeaderNavLink({
  item,
  children,
  className,
  isActive = false,
  ariaLabel,
  onNavigate,
}: HeaderNavLinkProps) {
  const ariaCurrent: AriaAttributes['aria-current'] = isActive ? 'page' : undefined
  const commonProps = {
    'aria-label': ariaLabel ?? item.label,
    'aria-current': ariaCurrent,
    activeOptions: { exact: true, includeSearch: true } as const,
    className,
    onClick: onNavigate,
  }

  switch (item.id) {
    case 'home':
      return <Link to="/" {...commonProps}>{children}</Link>
    case 'search-database':
      return <Link to="/utforsk" {...commonProps}>{children}</Link>
    case 'compare':
      return <Link to="/sammenlign" {...commonProps}>{children}</Link>
    case 'map':
      return <Link to="/kart" {...commonProps}>{children}</Link>
    case 'industries':
      return <Link to="/bransjer" {...commonProps}>{children}</Link>
    case 'industry-map':
      return <Link to="/bransjer" search={{ tab: 'map' as const }} {...commonProps}>{children}</Link>
    case 'industry-toplist':
      return <Link to="/bransjer" search={{ tab: 'toplist' as const }} {...commonProps}>{children}</Link>
    case 'industry-search':
      return <Link to="/bransjer" search={{ tab: 'search' as const }} {...commonProps}>{children}</Link>
    case 'new-companies':
      return <Link to="/nyetableringer" {...commonProps}>{children}</Link>
    case 'bankruptcies':
      return <Link to="/konkurser" {...commonProps}>{children}</Link>
    case 'regions':
      return <Link to="/regioner" {...commonProps}>{children}</Link>
    case 'counties':
      return <Link to="/fylker" {...commonProps}>{children}</Link>
    case 'municipalities':
      return <Link to="/kommuner" {...commonProps}>{children}</Link>
    case 'people':
      return <Link to="/person" {...commonProps}>{children}</Link>
    case 'person-search':
      return <Link to="/person" search={{ tab: 'sok' as const }} {...commonProps}>{children}</Link>
    case 'person-toplists':
      return <Link to="/person" search={{ tab: 'topplister' as const }} {...commonProps}>{children}</Link>
    case 'about':
      return <Link to="/om" {...commonProps}>{children}</Link>
    case 'data-sources':
      return <Link to="/om" hash="datakilder" {...commonProps}>{children}</Link>
  }
}

type HeaderQuickMenuProps = {
  id: string
  groups: readonly HeaderNavGroup[]
  pathname: string
  search: HeaderLocationSearch
  comparisonCount: number
  onNavigate: () => void
}

export function HeaderQuickMenu({
  id,
  groups,
  pathname,
  search,
  comparisonCount,
  onNavigate,
}: HeaderQuickMenuProps) {
  return (
    <div className="absolute right-2 top-full z-50 mt-2 w-[calc(100vw-1rem)] max-w-96 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/12 ring-1 ring-slate-950/5 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/40 sm:right-6">
      <nav
        id={id}
        aria-label="Hurtigmeny"
        className="max-h-[min(72vh,calc(100dvh-5rem))] overflow-y-auto overscroll-contain p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        {groups.map((group, groupIndex) => {
          const headingId = `${id}-${group.id}-heading`

          return (
            <section
              key={group.id}
              aria-labelledby={headingId}
              className={groupIndex === 0 ? 'pb-2' : 'border-t border-slate-200 py-2 dark:border-slate-800'}
            >
              <h2 id={headingId} className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                {group.label}
              </h2>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon
                  const isActive = isHeaderNavItemActive(pathname, search, item)

                  return (
                    <HeaderNavLink
                      key={`${group.id}-${getHeaderItemHref(item)}`}
                      item={item}
                      isActive={isActive}
                      ariaLabel={item.id === 'compare' && comparisonCount > 0 ? `${item.label} (${comparisonCount} valgt)` : item.label}
                      onNavigate={onNavigate}
                      className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 focus-visible:ring-offset-2 dark:focus-visible:ring-blue-300 dark:focus-visible:ring-offset-slate-950 ${isActive
                        ? 'bg-blue-900 text-white dark:bg-blue-500 dark:text-slate-950'
                        : 'text-slate-700 hover:bg-blue-50 hover:text-blue-950 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white'
                        }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.id === 'compare' && comparisonCount > 0 && (
                        <span aria-hidden="true" className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-900 px-1.5 text-[11px] font-black tabular-nums text-white dark:bg-blue-400 dark:text-slate-950">
                          {comparisonCount}
                        </span>
                      )}
                    </HeaderNavLink>
                  )
                })}
              </div>
            </section>
          )
        })}
      </nav>
    </div>
  )
}