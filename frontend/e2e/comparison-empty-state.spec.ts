import { expect, test, type Page } from '@playwright/test'

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

test('guides users from the empty comparison state without mobile overflow', async ({ page }) => {
  await page.goto('/sammenlign')

  await expect(page.getByRole('heading', { name: 'Velg virksomheter å sammenligne' })).toBeVisible()

  const energyExample = page.getByRole('link', { name: /Sammenlign Equinor, Aker BP og Vår Energi/i })
  await expect(energyExample).toHaveAttribute('href', /\/sammenlign\?orgnr=923609016%2C989795848%2C919160675$/)
  await expect(page.getByRole('link', { name: /Finn konkurrenter i samme kommune/i })).toHaveAttribute('href', '/utforsk')
  await expect(page.getByRole('link', { name: /Start fra en virksomhetsside/i })).toHaveAttribute('href', '/virksomhet/984661185')

  await expectNoHorizontalOverflow(page, [
    '[aria-labelledby="comparison-empty-title"]',
    'a[href^="/sammenlign?orgnr="]',
    'a[href="/utforsk"]',
    'a[href="/virksomhet/984661185"]',
  ])
})