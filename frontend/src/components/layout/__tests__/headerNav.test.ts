import { describe, expect, it } from 'vitest'
import {
  HEADER_DYNAMIC_ROUTE_PARENTS,
  HEADER_EXCLUDED_ROUTES,
  HEADER_QUICK_MENU_GROUPS,
  HEADER_STATIC_ENTRY_ROUTES,
  getHeaderItemHref,
  isHeaderNavItemActive,
  isHeaderPrimaryNavItemActive,
  type HeaderLocationSearch,
} from '../headerNav'

const menuItems = HEADER_QUICK_MENU_GROUPS.flatMap((group) => group.items)

function getActiveItemIds(pathname: string, search: HeaderLocationSearch = {}) {
  return menuItems
    .filter((item) => isHeaderNavItemActive(pathname, search, item))
    .map((item) => item.id)
}

describe('headerNav', () => {
  it('covers every static entry route from the burger menu', () => {
    const menuRoutes = new Set(menuItems.map((item) => item.to))

    for (const route of HEADER_STATIC_ENTRY_ROUTES) {
      expect(menuRoutes.has(route), `${route} should be reachable from the quick menu`).toBe(true)
    }
  })

  it('documents redirect and utility routes without exposing them as primary menu routes', () => {
    const menuHrefs = new Set(menuItems.map((item) => getHeaderItemHref(item)))

    for (const route of HEADER_EXCLUDED_ROUTES) {
      expect(menuHrefs.has(route), `${route} should stay out of the quick menu`).toBe(false)
    }
  })

  it('documents parent entries for dynamic drill-down routes', () => {
    const menuItemIds = new Set(menuItems.map((item) => item.id))

    for (const mapping of HEADER_DYNAMIC_ROUTE_PARENTS) {
      expect(menuItemIds.has(mapping.parentItemId), `${mapping.route} needs a menu parent`).toBe(true)
    }
  })

  it.each([
    ['/', {}, ['home']],
    ['/utforsk', {}, ['search-database']],
    ['/virksomhet/984661185', {}, ['search-database']],
    ['/bransjer', {}, ['industries']],
    ['/bransjer', { tab: 'stats' }, ['industries']],
    ['/bransjer', { tab: 'map' }, ['industry-map']],
    ['/bransjer', { tab: 'toplist' }, ['industry-toplist']],
    ['/bransjer', { tab: 'search' }, ['industry-search']],
    ['/bransje/62', {}, ['industries']],
    ['/oppdateringer', {}, ['activity']],
    ['/regioner', {}, ['regions']],
    ['/fylker', {}, ['counties']],
    ['/fylke/03-oslo', {}, ['counties']],
    ['/kommuner', {}, ['municipalities']],
    ['/kommune/0301-oslo', {}, ['municipalities']],
    ['/person', {}, ['people']],
    ['/person', { tab: 'sok' }, ['person-search']],
    ['/person', { tab: 'topplister' }, ['person-toplists']],
    ['/person/ola-nordmann/1980', {}, ['people']],
    ['/datakilder', {}, ['data-sources']],
  ])('marks the right menu item active for %s', (pathname, search, expectedIds) => {
    expect(getActiveItemIds(pathname, search)).toEqual(expectedIds)
  })

  it('builds route hrefs with search params and hash anchors', () => {
    const personSearch = menuItems.find((item) => item.id === 'person-search')
    const dataSources = menuItems.find((item) => item.id === 'data-sources')

    expect(personSearch ? getHeaderItemHref(personSearch) : '').toBe('/person?tab=sok')
    expect(dataSources ? getHeaderItemHref(dataSources) : '').toBe('/datakilder')
  })

  it('keeps top-level shortcuts active across their tabbed subpages', () => {
    const industries = menuItems.find((item) => item.id === 'industries')
    const people = menuItems.find((item) => item.id === 'people')

    expect(industries ? isHeaderPrimaryNavItemActive('/bransjer', { tab: 'map' }, industries) : false).toBe(true)
    expect(industries ? isHeaderNavItemActive('/bransjer', { tab: 'map' }, industries) : true).toBe(false)
    expect(people ? isHeaderPrimaryNavItemActive('/person', { tab: 'sok' }, people) : false).toBe(true)
    expect(people ? isHeaderNavItemActive('/person', { tab: 'sok' }, people) : true).toBe(false)
  })
})