/**
 * SEO metadata constants
 */

export const SEO_DEFAULTS = {
  title: 'Bedriftsgrafen.no - Gratis Søk i Norske Bedrifter',
  description: 'Søk, analyser og sammenlign 1.1 millioner norske bedrifter gratis. Få innsikt i regnskapstall, soliditet og utvikling med interaktive grafer.',
  ogImage: 'https://bedriftsgrafen.no/og-image.png',
  siteUrl: 'https://bedriftsgrafen.no',
}

export const getCompanyTitle = (companyName: string) => 
  `${companyName} - Regnskap og Nøkkeltall | Bedriftsgrafen`

export const getCompanyDescription = (companyName: string, orgnr: string) =>
  `Se regnskapstall, nøkkeltall og utvikling for ${companyName} (Org.nr: ${orgnr}) på Bedriftsgrafen.no`
