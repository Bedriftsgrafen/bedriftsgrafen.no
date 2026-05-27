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

async function expectReadableContrast(page: Page, selectors: string[]) {
  const failures = await page.evaluate((targetSelectors) => {
    type Rgba = { r: number; g: number; b: number; a: number }

    function parseRgb(color: string): Rgba | null {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
      if (!match) return null

      return {
        r: Number(match[1]),
        g: Number(match[2]),
        b: Number(match[3]),
        a: match[4] === undefined ? 1 : Number(match[4]),
      }
    }

    function composite(foreground: Rgba, background: Rgba): Rgba {
      const alpha = foreground.a + background.a * (1 - foreground.a)
      if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 }

      return {
        r: Math.round((foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha),
        g: Math.round((foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha),
        b: Math.round((foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha),
        a: alpha,
      }
    }

    function relativeLuminance({ r, g, b }: Rgba) {
      const [red, green, blue] = [r, g, b].map((value) => {
        const channel = value / 255
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })

      return 0.2126 * red + 0.7152 * green + 0.0722 * blue
    }

    function contrastRatio(foreground: Rgba, background: Rgba) {
      const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background))
      const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background))

      return (lighter + 0.05) / (darker + 0.05)
    }

    function effectiveBackground(element: Element): Rgba {
      const ancestors: Element[] = []
      let current: Element | null = element

      while (current) {
        ancestors.push(current)
        current = current.parentElement
      }

      return ancestors.reverse().reduce<Rgba>((background, ancestor) => {
        const parsed = parseRgb(getComputedStyle(ancestor).backgroundColor)
        return parsed ? composite(parsed, background) : background
      }, { r: 2, g: 6, b: 23, a: 1 })
    }

    return targetSelectors.flatMap((selector) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector)).flatMap((element) => {
        const text = Array.from(element.childNodes)
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent?.trim() ?? '')
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()

        if (!text) return []

        const style = getComputedStyle(element)
        const foreground = parseRgb(style.color)
        if (!foreground) return []

        const background = effectiveBackground(element)
        const ratio = contrastRatio(foreground, background)
        const fontSize = Number.parseFloat(style.fontSize)
        const fontWeight = Number.parseInt(style.fontWeight, 10) || 400
        const required = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700) ? 3 : 4.5

        return ratio >= required
          ? []
          : [{ selector, text, ratio: Number(ratio.toFixed(2)), required }]
      }),
    )
  }, selectors)

  expect(failures).toEqual([])
}

async function expectDarkSurfaces(page: Page, selectors: string[]) {
  const brightSurfaces = await page.evaluate((targetSelectors) => {
    type Rgba = { r: number; g: number; b: number; a: number }

    function parseRgb(color: string): Rgba | null {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
      if (!match) return null

      return {
        r: Number(match[1]),
        g: Number(match[2]),
        b: Number(match[3]),
        a: match[4] === undefined ? 1 : Number(match[4]),
      }
    }

    function composite(foreground: Rgba, background: Rgba): Rgba {
      const alpha = foreground.a + background.a * (1 - foreground.a)
      if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 }

      return {
        r: Math.round((foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha),
        g: Math.round((foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha),
        b: Math.round((foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha),
        a: alpha,
      }
    }

    function relativeLuminance({ r, g, b }: Rgba) {
      const [red, green, blue] = [r, g, b].map((value) => {
        const channel = value / 255
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      })

      return 0.2126 * red + 0.7152 * green + 0.0722 * blue
    }

    function effectiveBackground(element: Element): Rgba {
      const ancestors: Element[] = []
      let current: Element | null = element

      while (current) {
        ancestors.push(current)
        current = current.parentElement
      }

      return ancestors.reverse().reduce<Rgba>((background, ancestor) => {
        const parsed = parseRgb(getComputedStyle(ancestor).backgroundColor)
        return parsed ? composite(parsed, background) : background
      }, { r: 2, g: 6, b: 23, a: 1 })
    }

    return targetSelectors.flatMap((selector) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector)).flatMap((element) => {
        const luminance = relativeLuminance(effectiveBackground(element))
        return luminance <= 0.18 ? [] : [{ selector, luminance: Number(luminance.toFixed(3)) }]
      }),
    )
  }, selectors)

  expect(brightSurfaces).toEqual([])
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

test('keeps the empty comparison state readable in dark mode', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'bedriftsgrafen-theme',
      JSON.stringify({ state: { theme: 'dark' }, version: 0 }),
    )
  })

  await page.goto('/sammenlign')

  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByRole('heading', { name: 'Velg virksomheter å sammenligne' })).toBeVisible()

  await expectDarkSurfaces(page, [
    '[aria-labelledby="comparison-empty-title"]',
    'a[href^="/sammenlign?orgnr="]',
    'a[href="/utforsk"]',
    'a[href="/virksomhet/984661185"]',
  ])

  await expectReadableContrast(page, [
    '#comparison-empty-title',
    '[aria-labelledby="comparison-empty-title"] p',
    'a[href^="/sammenlign?orgnr="] span',
    'a[href="/utforsk"] span',
    'a[href="/virksomhet/984661185"] span',
  ])

  await expectNoHorizontalOverflow(page, [
    '[aria-labelledby="comparison-empty-title"]',
    'a[href^="/sammenlign?orgnr="]',
    'a[href="/utforsk"]',
    'a[href="/virksomhet/984661185"]',
  ])
})

test('shows a readable dark-mode error card when comparison data cannot load', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem(
      'bedriftsgrafen-theme',
      JSON.stringify({ state: { theme: 'dark' }, version: 0 }),
    )
  })

  await page.route('**/api/v1/companies/932115948', async (route) => {
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not found' }) })
  })

  await page.goto('/sammenlign?orgnr=%22932115948%22')

  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByRole('heading', { name: 'Sammenligning' })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('Kunne ikke hente virksomheten')
  await expect(page.getByRole('link', { name: /Finn virksomhet/i })).toHaveAttribute('href', '/utforsk')

  await expectDarkSurfaces(page, ['[data-testid="comparison-error-card"]'])
  await expectReadableContrast(page, [
    '[data-testid="comparison-error-card"] p',
    '[data-testid="comparison-error-card"] a',
  ])
})