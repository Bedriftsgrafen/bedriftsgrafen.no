import { afterEach, describe, expect, it, vi } from 'vitest'

describe('SEO_DEFAULTS', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('defaults to the current Bedriftsgrafen domain', async () => {
    const { SEO_DEFAULTS } = await import('../seo')

    expect(SEO_DEFAULTS.siteName).toBe('Bedriftsgrafen.no')
    expect(SEO_DEFAULTS.siteUrl).toBe('https://bedriftsgrafen.no')
    expect(SEO_DEFAULTS.ogImage).toBe('https://bedriftsgrafen.no/og-image.webp')
  })

  it('can be built with another canonical site URL', async () => {
    vi.stubEnv('VITE_SITE_URL', 'https://virx.no/')
    vi.stubEnv('VITE_SITE_NAME', 'VIRX.no')

    const { SEO_DEFAULTS } = await import('../seo')

    expect(SEO_DEFAULTS.siteName).toBe('VIRX.no')
    expect(SEO_DEFAULTS.siteUrl).toBe('https://virx.no')
    expect(SEO_DEFAULTS.ogImage).toBe('https://virx.no/og-image.webp')
  })
})
