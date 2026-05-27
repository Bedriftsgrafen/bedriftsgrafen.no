import { expect, test, type Page } from '@playwright/test'

const timestamp = Date.parse('2026-05-27T12:00:00.000Z')

const statsResponse = {
  total_companies: 1_162_204,
  total_accounting_reports: 420_000,
  total_revenue: 0,
  total_ebitda: 0,
  total_employees: 2_200_000,
  profitable_percentage: 64,
  solid_company_percentage: 58,
  avg_operating_margin: 7.2,
  new_companies_ytd: 18_500,
  new_companies_30d: 1_280,
  bankruptcies: 280,
  geocoded_count: 950_000,
  total_roles: 3_400_000,
  avg_board_age: 48,
}

const favorites = [
  {
    orgnr: '923609016',
    navn: 'EQUINOR ENERGY AS MED ET EKSTRA LANGT NAVN SOM SKAL TRUNKERES',
    organisasjonsform: 'AS',
    addedAt: timestamp,
  },
]

const recentCompanies = [
  {
    orgnr: '984661185',
    navn: 'POSTEN BRING AS MED EKSTRA LANGT NAVN FOR MOBIL OVERFLOWTEST',
    organisasjonsform: 'AS',
    timestamp,
  },
]

async function seedPersonalShortcuts(page: Page) {
  await page.route('**/api/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(statsResponse),
    })
  })

  await page.addInitScript(
    ({ favoriteItems, recentItems }) => {
      window.localStorage.setItem(
        'bedriftsgrafen-favorites',
        JSON.stringify({ state: { favorites: favoriteItems }, version: 0 }),
      )
      window.localStorage.setItem(
        'bedriftsgrafen-ui-storage',
        JSON.stringify({
          state: {
            recentCompanies: recentItems,
            recentSearches: [],
          },
          version: 0,
        }),
      )
    },
    { favoriteItems: favorites, recentItems: recentCompanies },
  )
}

async function expectPersonalSectionWithinViewport(page: Page) {
  const overflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth
    const selectors = [
      '[aria-labelledby="personal-section-title"]',
      '[aria-labelledby="favorites-title"]',
      '[aria-labelledby="recent-companies-title"]',
    ]

    return selectors.flatMap((selector) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector))
        .map((element) => {
          const rect = element.getBoundingClientRect()
          return {
            selector,
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            width: Math.round(rect.width),
            viewportWidth,
          }
        })
        .filter(({ left, right }) => left < -1 || right > viewportWidth + 1),
    )
  })

  const pageWidth = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))

  expect(overflow).toEqual([])
  expect(pageWidth.scrollWidth).toBeLessThanOrEqual(pageWidth.clientWidth + 1)
}

test('keeps favorite and history cards inside the viewport', async ({ page }) => {
  await seedPersonalShortcuts(page)

  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Fortsett der du slapp' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dine favoritter' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Nylig besøkte virksomheter' })).toBeVisible()

  await expectPersonalSectionWithinViewport(page)
})