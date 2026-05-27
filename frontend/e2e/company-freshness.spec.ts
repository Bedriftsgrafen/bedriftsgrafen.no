import { expect, test, type Page } from '@playwright/test'

const companyResponse = {
  orgnr: '984661185',
  navn: 'POSTEN BRING AS',
  organisasjonsform: 'AS',
  naeringskode: { kode: '53.100', beskrivelse: 'Landsdekkende posttjenester' },
  naeringskoder: [{ kode: '53.100', beskrivelse: 'Landsdekkende posttjenester' }],
  antall_ansatte: 12_735,
  stiftelsesdato: '2002-06-21',
  registreringsdato_enhetsregisteret: '2002-07-15',
  registreringsdato_foretaksregisteret: '2002-07-15',
  konkurs: false,
  under_avvikling: false,
  under_tvangsavvikling: false,
  registrert_i_foretaksregisteret: true,
  registrert_i_mvaregisteret: true,
  siste_innsendte_aarsregnskap: '2024',
  last_polled_regnskap: '2026-05-27',
  geocoded_at: '2026-05-20T08:30:00Z',
  latitude: 59.9111,
  longitude: 10.7528,
  forretningsadresse: {
    adresse: ['Biskop Gunnerus gate 14A'],
    postnummer: '0185',
    poststed: 'OSLO',
    land: 'Norge',
    kommune: 'Oslo',
    kommunenummer: '0301',
  },
  postadresse: {
    adresse: ['Postboks 1500 Sentrum'],
    postnummer: '0001',
    poststed: 'OSLO',
    land: 'Norge',
  },
  regnskap: [
    {
      id: 1,
      aar: 2024,
      periode_til: '2024-12-31',
      total_inntekt: 24_200_000_000,
      aarsresultat: 810_000_000,
      egenkapital: 4_900_000_000,
      gjeldsgrad: null,
      driftsresultat: 980_000_000,
      salgsinntekter: 24_200_000_000,
      omloepsmidler: 5_100_000_000,
      kortsiktig_gjeld: 3_300_000_000,
      avskrivninger: 450_000_000,
    },
  ],
}

async function mockCompanyPageApi(page: Page) {
  await page.route('**/api/v1/companies/984661185/similar', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) })
  })

  await page.route('**/api/v1/companies/984661185/accounting/record/*', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...companyResponse.regnskap[0], kpis: null }) })
  })

  await page.route('**/api/v1/companies/984661185', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(companyResponse) })
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

async function expectDarkSurface(page: Page, selector: string) {
  const luminance = await page.locator(selector).evaluate((element) => {
    const color = getComputedStyle(element).backgroundColor
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (!match) return 0

    const [red, green, blue] = [Number(match[1]), Number(match[2]), Number(match[3])].map((value) => {
      const channel = value / 255
      return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    })

    return 0.2126 * red + 0.7152 * green + 0.0722 * blue
  })

  expect(luminance).toBeLessThan(0.2)
}

test('shows truthful company freshness data without mobile dark-mode overflow', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'bedriftsgrafen-theme',
      JSON.stringify({ state: { theme: 'dark' }, version: 0 }),
    )
  })
  await mockCompanyPageApi(page)

  await page.goto('/virksomhet/984661185')

  const section = page.locator('section[aria-labelledby="company-timeline-heading"]')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByRole('heading', { name: 'Hendelser og datagrunnlag' })).toBeVisible()
  await expect(section).toContainText('Regnskapsdata kontrollert')
  await expect(section).toContainText('ikke offisiell innsendingsdato')
  await expect(section).toContainText('ingen pålitelig oppdatert-dato fra Brreg')

  await expectDarkSurface(page, 'section[aria-labelledby="company-timeline-heading"]')
  await expectNoHorizontalOverflow(page, [
    'section[aria-labelledby="company-timeline-heading"]',
    'section[aria-labelledby="company-timeline-heading"] time',
    'section[aria-labelledby="company-timeline-heading"] a',
  ])
})