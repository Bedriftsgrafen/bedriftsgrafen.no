import type { ComponentType } from 'react'
import type { LucideProps } from 'lucide-react'
import {
  AlertTriangle,
  Activity,
  ArrowLeftRight,
  Award,
  BarChart3,
  Building2,
  Database,
  Home,
  Info,
  Map,
  MapPin,
  Search,
  Sparkles,
  Users,
} from 'lucide-react'

export type HeaderRouteTo =
  | '/'
  | '/utforsk'
  | '/sammenlign'
  | '/kart'
  | '/bransjer'
  | '/nyetableringer'
  | '/konkurser'
  | '/oppdateringer'
  | '/datakilder'
  | '/regioner'
  | '/fylker'
  | '/kommuner'
  | '/person'
  | '/om'

export type HeaderSearch = {
  readonly tab?: 'sok' | 'topplister' | 'map' | 'toplist' | 'search'
}

export type HeaderLocationSearch = {
  readonly tab?: unknown
}

export type HeaderTopBarVisibility = 'lg' | 'xl' | 'menu-only'

export type HeaderNavItem = {
  readonly id: string
  readonly label: string
  readonly topLabel?: string
  readonly to: HeaderRouteTo
  readonly search?: HeaderSearch
  readonly hash?: 'datakilder'
  readonly icon: ComponentType<LucideProps>
  readonly topBar: HeaderTopBarVisibility
}

export type HeaderNavGroup = {
  readonly id: string
  readonly label: string
  readonly items: readonly HeaderNavItem[]
}

const HOME_ITEM: HeaderNavItem = {
  id: 'home',
  label: 'Forside',
  to: '/',
  icon: Home,
  topBar: 'menu-only',
}

const SEARCH_ITEM: HeaderNavItem = {
  id: 'search-database',
  label: 'Søk i databasen',
  topLabel: 'Søk',
  to: '/utforsk',
  icon: Search,
  topBar: 'lg',
}

const COMPARE_ITEM: HeaderNavItem = {
  id: 'compare',
  label: 'Sammenlign virksomheter',
  topLabel: 'Sammenlign',
  to: '/sammenlign',
  icon: ArrowLeftRight,
  topBar: 'lg',
}

const MAP_ITEM: HeaderNavItem = {
  id: 'map',
  label: 'Kart',
  to: '/kart',
  icon: Map,
  topBar: 'xl',
}

const INDUSTRIES_ITEM: HeaderNavItem = {
  id: 'industries',
  label: 'Bransjer',
  to: '/bransjer',
  icon: BarChart3,
  topBar: 'xl',
}

const INDUSTRY_MAP_ITEM: HeaderNavItem = {
  id: 'industry-map',
  label: 'Bransjekart',
  to: '/bransjer',
  search: { tab: 'map' },
  icon: Map,
  topBar: 'menu-only',
}

const INDUSTRY_TOPLIST_ITEM: HeaderNavItem = {
  id: 'industry-toplist',
  label: 'Bransjetopplister',
  to: '/bransjer',
  search: { tab: 'toplist' },
  icon: Award,
  topBar: 'menu-only',
}

const INDUSTRY_SEARCH_ITEM: HeaderNavItem = {
  id: 'industry-search',
  label: 'Søk virksomheter etter bransje',
  to: '/bransjer',
  search: { tab: 'search' },
  icon: Search,
  topBar: 'menu-only',
}

const NEW_COMPANIES_ITEM: HeaderNavItem = {
  id: 'new-companies',
  label: 'Nyetableringer',
  to: '/nyetableringer',
  icon: Sparkles,
  topBar: 'menu-only',
}

const BANKRUPTCIES_ITEM: HeaderNavItem = {
  id: 'bankruptcies',
  label: 'Konkurser',
  to: '/konkurser',
  icon: AlertTriangle,
  topBar: 'menu-only',
}

const ACTIVITY_ITEM: HeaderNavItem = {
  id: 'activity',
  label: 'Oppdateringer',
  to: '/oppdateringer',
  icon: Activity,
  topBar: 'menu-only',
}

const REGIONS_ITEM: HeaderNavItem = {
  id: 'regions',
  label: 'Regioner',
  to: '/regioner',
  icon: MapPin,
  topBar: 'menu-only',
}

const COUNTIES_ITEM: HeaderNavItem = {
  id: 'counties',
  label: 'Fylker',
  to: '/fylker',
  icon: MapPin,
  topBar: 'menu-only',
}

const MUNICIPALITIES_ITEM: HeaderNavItem = {
  id: 'municipalities',
  label: 'Kommuner',
  to: '/kommuner',
  icon: Building2,
  topBar: 'menu-only',
}

const PEOPLE_ITEM: HeaderNavItem = {
  id: 'people',
  label: 'Personer',
  to: '/person',
  icon: Users,
  topBar: 'xl',
}

const PERSON_SEARCH_ITEM: HeaderNavItem = {
  id: 'person-search',
  label: 'Personsøk',
  to: '/person',
  search: { tab: 'sok' },
  icon: Search,
  topBar: 'menu-only',
}

const PERSON_TOPLISTS_ITEM: HeaderNavItem = {
  id: 'person-toplists',
  label: 'Persontopplister',
  to: '/person',
  search: { tab: 'topplister' },
  icon: BarChart3,
  topBar: 'menu-only',
}

const ABOUT_ITEM: HeaderNavItem = {
  id: 'about',
  label: 'Om Bedriftsgrafen',
  to: '/om',
  icon: Info,
  topBar: 'menu-only',
}

const DATA_SOURCES_ITEM: HeaderNavItem = {
  id: 'data-sources',
  label: 'Datakilder',
  to: '/datakilder',
  icon: Database,
  topBar: 'menu-only',
}

export const HEADER_TOP_NAV_ITEMS: readonly HeaderNavItem[] = [
  SEARCH_ITEM,
  INDUSTRIES_ITEM,
  MAP_ITEM,
  PEOPLE_ITEM,
] as const

export const HEADER_UTILITY_NAV_ITEMS: readonly HeaderNavItem[] = [COMPARE_ITEM]

export const HEADER_MOBILE_SHORTCUT_ITEMS: readonly HeaderNavItem[] = [SEARCH_ITEM, COMPARE_ITEM]

export const HEADER_QUICK_MENU_GROUPS: readonly HeaderNavGroup[] = [
  {
    id: 'start',
    label: 'Start',
    items: [HOME_ITEM],
  },
  {
    id: 'search-analysis',
    label: 'Søk og analyse',
    items: [SEARCH_ITEM, COMPARE_ITEM, MAP_ITEM],
  },
  {
    id: 'companies',
    label: 'Virksomheter',
    items: [
      INDUSTRIES_ITEM,
      INDUSTRY_MAP_ITEM,
      INDUSTRY_TOPLIST_ITEM,
      INDUSTRY_SEARCH_ITEM,
      ACTIVITY_ITEM,
      NEW_COMPANIES_ITEM,
      BANKRUPTCIES_ITEM,
    ],
  },
  {
    id: 'regions',
    label: 'Regioner',
    items: [REGIONS_ITEM, COUNTIES_ITEM, MUNICIPALITIES_ITEM],
  },
  {
    id: 'people',
    label: 'Roller og personer',
    items: [PEOPLE_ITEM, PERSON_SEARCH_ITEM, PERSON_TOPLISTS_ITEM],
  },
  {
    id: 'about',
    label: 'Om',
    items: [ABOUT_ITEM, DATA_SOURCES_ITEM],
  },
]

export const HEADER_STATIC_ENTRY_ROUTES = [
  '/',
  '/utforsk',
  '/sammenlign',
  '/kart',
  '/bransjer',
  '/nyetableringer',
  '/konkurser',
  '/oppdateringer',
  '/datakilder',
  '/regioner',
  '/fylker',
  '/kommuner',
  '/person',
  '/om',
] as const satisfies readonly HeaderRouteTo[]

export const HEADER_EXCLUDED_ROUTES = [
  '/personer',
  '/bedrift/$orgnr',
  '/$',
] as const

export const HEADER_DYNAMIC_ROUTE_PARENTS = [
  { route: '/virksomhet/$orgnr', parentItemId: 'search-database' },
  { route: '/bransje/$code', parentItemId: 'industries' },
  { route: '/fylke/$code', parentItemId: 'counties' },
  { route: '/kommune/$code', parentItemId: 'municipalities' },
  { route: '/person/$name/$birthdate', parentItemId: 'people' },
] as const

export function getHeaderItemHref(item: HeaderNavItem): string {
  const search = item.search?.tab ? `?tab=${item.search.tab}` : ''
  const hash = item.hash ? `#${item.hash}` : ''
  return `${item.to}${search}${hash}`
}

export function isHeaderNavItemActive(
  pathname: string,
  search: HeaderLocationSearch,
  item: HeaderNavItem,
): boolean {
  const tab = typeof search.tab === 'string' ? search.tab : undefined

  if (item.id === 'search-database') {
    return pathname === '/utforsk' || pathname.startsWith('/virksomhet/')
  }

  if (item.id === 'industries') {
    return pathname.startsWith('/bransje/') || (pathname === '/bransjer' && (tab === undefined || tab === 'stats'))
  }

  if (item.id === 'industry-map') {
    return pathname === '/bransjer' && tab === 'map'
  }

  if (item.id === 'industry-toplist') {
    return pathname === '/bransjer' && tab === 'toplist'
  }

  if (item.id === 'industry-search') {
    return pathname === '/bransjer' && tab === 'search'
  }

  if (item.id === 'regions') {
    return pathname === '/regioner'
  }

  if (item.id === 'counties') {
    return pathname === '/fylker' || pathname.startsWith('/fylke/')
  }

  if (item.id === 'municipalities') {
    return pathname === '/kommuner' || pathname.startsWith('/kommune/')
  }

  if (item.id === 'people') {
    return pathname.startsWith('/person/') || (pathname === '/person' && (tab === undefined || tab === 'oversikt'))
  }

  if (item.id === 'person-search') {
    return pathname === '/person' && tab === 'sok'
  }

  if (item.id === 'person-toplists') {
    return pathname === '/person' && tab === 'topplister'
  }

  if (item.id === 'data-sources') {
    return pathname === '/datakilder'
  }

  return pathname === item.to
}

export function isHeaderPrimaryNavItemActive(
  pathname: string,
  search: HeaderLocationSearch,
  item: HeaderNavItem,
): boolean {
  if (item.id === 'industries') {
    return pathname === '/bransjer' || pathname.startsWith('/bransje/')
  }

  if (item.id === 'people') {
    return pathname === '/person' || pathname.startsWith('/person/')
  }

  return isHeaderNavItemActive(pathname, search, item)
}