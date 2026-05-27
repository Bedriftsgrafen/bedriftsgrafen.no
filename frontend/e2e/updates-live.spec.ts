import { expect, test } from '@playwright/test'

test.skip(!process.env.PLAYWRIGHT_LIVE_ACTIVITY, 'Requires a running backend and real /api/v1/activity proxy')

test('loads live updates hub from the activity endpoint', async ({ page }) => {
  const failedActivityResponses: Array<{ url: string; status: number }> = []

  page.on('response', (response) => {
    const url = response.url()
    if (url.includes('/api/v1/activity/overview') && response.status() >= 400) {
      failedActivityResponses.push({ url, status: response.status() })
    }
  })

  await page.goto('/oppdateringer')

  await expect(page.getByRole('heading', { name: 'Siste oppdateringer' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Nye virksomheter' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Konkurser og avvikling' })).toBeVisible()
  await expect(page.getByText(/Regnskapsoppdateringer venter/i)).toBeVisible()
  await expect(page.getByText('Hello "/oppdateringer"!')).toBeHidden()

  const companyRows = page.locator('a[href^="/virksomhet/"]')
  await expect(companyRows.first()).toBeVisible()
  await expect(failedActivityResponses).toEqual([])
})
