import { expect, test } from '@playwright/test'

test.skip(!process.env.PLAYWRIGHT_LIVE_STATS, 'Requires a running backend and real /api/stats proxy')

test('loads live homepage stats without server error toast', async ({ page }) => {
  const failedStatsResponses: Array<{ url: string; status: number }> = []

  page.on('response', (response) => {
    const url = response.url()
    if ((url.includes('/api/stats') || url.includes('/api/v1/companies/stats')) && response.status() >= 400) {
      failedStatsResponses.push({ url, status: response.status() })
    }
  })

  await page.goto('/')

  const trustMetrics = page.locator('[aria-labelledby="trust-metrics-title"]')
  const activitySection = page.locator('[aria-labelledby="live-data-title"]')
  const newCompaniesCard = activitySection.locator('a[href="/nyetableringer"]').filter({ hasText: 'Nye virksomheter' })

  await expect(page.getByRole('heading', { name: 'Siste bevegelser' })).toBeVisible()
  await expect(trustMetrics.locator('dl').nth(0).locator('dd')).not.toHaveText('-')
  await expect(trustMetrics.locator('dl').nth(1).locator('dd')).not.toHaveText('-')
  await expect(trustMetrics.locator('dl').nth(2).locator('dd')).not.toHaveText('-')
  await expect(newCompaniesCard).toBeVisible()
  await expect(newCompaniesCard).not.toContainText('Se oversikt')
  await expect(page.getByText('Serverfeil. Prøv igjen senere.')).toBeHidden()
  expect(failedStatsResponses).toEqual([])
})