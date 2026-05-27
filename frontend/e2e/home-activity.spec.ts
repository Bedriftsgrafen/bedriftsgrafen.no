import { expect, test, type Page } from '@playwright/test'

const statsResponse = {
  total_companies: 1_163_193,
  total_accounting_reports: 420_174,
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

async function mockStats(page: Page) {
  await page.route('**/api/stats', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(statsResponse),
    })
  })
}

async function mockStatsFailure(page: Page) {
  await page.route('**/api/stats', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Server error' }),
    })
  })
}

async function expectNoHorizontalOverflow(page: Page, selectors: string[]) {
  const overflow = await page.evaluate((targetSelectors) => {
    const viewportWidth = document.documentElement.clientWidth

    return targetSelectors.flatMap((selector) =>
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
  }, selectors)

  const pageWidth = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))

  expect(overflow).toEqual([])
  expect(pageWidth.scrollWidth).toBeLessThanOrEqual(pageWidth.clientWidth + 1)
}

test('shows homepage activity links without mobile dark-mode overflow', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'bedriftsgrafen-theme',
      JSON.stringify({ state: { theme: 'dark' }, version: 0 }),
    )
  })
  await mockStats(page)

  await page.goto('/')

  const section = page.locator('[aria-labelledby="live-data-title"]')
  const headerLogo = page.locator('header a[aria-label="Bedriftsgrafen.no"] img').first()

  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(headerLogo).toBeVisible()
  await expect.poll(async () => headerLogo.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
  await expect(page.getByRole('heading', { name: 'Siste bevegelser' })).toBeVisible()
  await expect(section).toContainText('Basert på registreringsdatoer i Enhetsregisteret')
  await expect(section).toContainText('ikke siste innsendingsdato')
  await expect(section.getByRole('link', { name: /Se nyetableringer/i }).first()).toHaveAttribute('href', '/nyetableringer')
  await expect(section.getByRole('link', { name: /Se konkurser/i }).first()).toHaveAttribute('href', '/konkurser')
  await expect(section.getByRole('link', { name: /Utforsk datagrunnlaget/i })).toHaveAttribute('href', '/utforsk')

  await expectNoHorizontalOverflow(page, [
    '[aria-labelledby="live-data-title"]',
    '[aria-labelledby="live-data-title"] a',
  ])
})

test('keeps activity links visible without server toast when stats fail', async ({ page }) => {
  let companyStatsRequests = 0
  await mockStatsFailure(page)
  await page.route('**/api/v1/companies/stats', async (route) => {
    companyStatsRequests += 1
    await route.abort()
  })

  await page.goto('/')

  const activitySection = page.locator('[aria-labelledby="live-data-title"]')

  await expect(page.getByRole('heading', { name: 'Siste bevegelser' })).toBeVisible()
  await expect(activitySection).toContainText('Se oversikt')
  await expect(activitySection).toContainText('Se data')
  await expect(activitySection.getByRole('link', { name: /Se nyetableringer/i }).first()).toHaveAttribute('href', '/nyetableringer')
  await expect(activitySection.getByRole('link', { name: /Se konkurser/i }).first()).toHaveAttribute('href', '/konkurser')
  await expect(page.getByText('Serverfeil. Prøv igjen senere.')).toBeHidden()
  expect(companyStatsRequests).toBe(0)
})