import { expect, test, type Page } from '@playwright/test'

const activityResponse = {
  generated_at: '2026-05-27T14:30:00Z',
  cache_ttl_seconds: 120,
  new_companies: {
    id: 'new_companies',
    title: 'Nye virksomheter',
    description: 'Nyeste registreringer i Enhetsregisteret som finnes hos Bedriftsgrafen.',
    source: 'Enhetsregisteret via Brreg',
    time_label: 'Registreringsdato',
    items: [
      {
        orgnr: '123456789',
        navn: 'Test Bedrift AS',
        organisasjonsform: 'AS',
        naeringskode: '62.010',
        antall_ansatte: 12,
        event_date: '2026-05-27',
        event_label: 'Registrert i Enhetsregisteret',
        source: 'Enhetsregisteret via Brreg',
        time_semantics: 'Kildedato fra Enhetsregisteret, ikke Bedriftsgrafens importtidspunkt.',
      },
    ],
  },
  bankruptcies: {
    id: 'bankruptcies',
    title: 'Konkurser og avvikling',
    description: 'Virksomheter med konkursdato registrert i datagrunnlaget.',
    source: 'Enhetsregisteret via Brreg',
    time_label: 'Konkursdato',
    items: [
      {
        orgnr: '987654321',
        navn: 'Avsluttet Firma AS',
        organisasjonsform: 'AS',
        naeringskode: '47.110',
        antall_ansatte: 4,
        event_date: '2026-05-26',
        event_label: 'Konkurs registrert',
        source: 'Enhetsregisteret via Brreg',
        time_semantics: 'Kildedato fra Brreg.',
      },
    ],
  },
  data_status: [
    {
      key: 'company_update_last_sync_date',
      title: 'Enhetsregisteret',
      description: 'Siste dato Bedriftsgrafen har synket fra Brregs oppdateringsstrøm.',
      value: '2026-05-27',
      updated_at: '2026-05-27T14:04:00Z',
      source: 'Brreg oppdateringsstrøm',
    },
  ],
  deferred_feeds: [
    {
      id: 'accounting_updates',
      title: 'Nye regnskap hos Bedriftsgrafen',
      reason: 'Regnskapstabellen mangler i dag en trygg indeks for siste oppdatering.',
      requirement: 'Legg til indeks eller skriv regnskapshendelser til eventloggen før dette blir en offentlig live-feed.',
    },
  ],
}

async function mockActivity(page: Page) {
  await page.route('**/api/v1/activity/overview**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(activityResponse),
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

test('renders updates hub with indexed feeds and dark-mode mobile-safe layout', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'bedriftsgrafen-theme',
      JSON.stringify({ state: { theme: 'dark' }, version: 0 }),
    )
  })
  await mockActivity(page)

  await page.goto('/oppdateringer')

  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByRole('heading', { name: 'Siste oppdateringer' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Nye virksomheter' })).toBeVisible()
  await expect(page.getByText('Test Bedrift AS')).toBeVisible()
  await expect(page.getByText('Avsluttet Firma AS')).toBeVisible()
  await expect(page.getByText(/Regnskapsoppdateringer venter/i)).toBeVisible()
  await expect(page.getByText(/mangler i dag en trygg indeks/i)).toBeVisible()

  await page.getByRole('link', { name: /Datastatus/i }).click()
  await expect(page).toHaveURL(/tab=datastatus/)
  await expect(page.getByText('Brreg oppdateringsstrøm')).toBeVisible()
  await expect(page.getByText('Test Bedrift AS')).toBeHidden()

  await expectNoHorizontalOverflow(page, ['main', 'header', 'nav', 'section'])
})

test('shows inline error without global server toast when activity fails', async ({ page }) => {
  await page.route('**/api/v1/activity/overview**', async (route) => {
    await route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ detail: 'Internal server error' }),
    })
  })

  await page.goto('/oppdateringer')

  await expect(page.getByRole('heading', { name: 'Siste oppdateringer' })).toBeVisible()
  await expect(page.getByText('Kunne ikke laste oppdateringer akkurat nå')).toBeVisible()
  await expect(page.getByText('Serverfeil. Prøv igjen senere.')).toBeHidden()
})
