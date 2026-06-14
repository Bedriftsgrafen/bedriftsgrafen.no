/**
 * SEO metadata constants
 */

const DEFAULT_SITE_URL = 'https://bedriftsgrafen.no'
const DEFAULT_SITE_NAME = 'Bedriftsgrafen.no'

function normalizeSiteUrl(url: string | undefined): string {
  const trimmedUrl = url?.trim().replace(/\/+$/, '')
  return trimmedUrl || DEFAULT_SITE_URL
}

export const SEO_DEFAULTS = {
  title: 'Bedriftsgrafen.no - Gratis Søk i Norske Virksomheter',
  description: 'Søk, analyser og sammenlign 1.1 millioner norske virksomheter gratis. Få innsikt i regnskapstall, soliditet og utvikling med interaktive grafer.',
  siteName: import.meta.env.VITE_SITE_NAME?.trim() || DEFAULT_SITE_NAME,
  siteUrl: normalizeSiteUrl(import.meta.env.VITE_SITE_URL),
  ogImage: `${normalizeSiteUrl(import.meta.env.VITE_SITE_URL)}/og-image.webp`,
}

export const getCompanyTitle = (companyName: string) => 
  `${companyName} - Regnskap og Nøkkeltall | Bedriftsgrafen`

export const getCompanyDescription = (companyName: string, orgnr: string) =>
  `Se regnskapstall, nøkkeltall og utvikling for ${companyName} (Org.nr: ${orgnr}) på Bedriftsgrafen.no`
