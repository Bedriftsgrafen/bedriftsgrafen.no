import { useMemo } from 'react'
import { useLocation } from '@tanstack/react-router'
import { SEO_DEFAULTS, getCompanyTitle } from '../../constants/seo'
import type { Address } from '../../types/company'

/**
 * Extended company data for SEO structured data
 */
interface CompanyDataProps {
  address?: Address
  hjemmeside?: string
  stiftelsesdato?: string
  antall_ansatte?: number
}

interface SEOHeadProps {
  companyName?: string
  orgnr?: string
  title?: string
  description?: string
  /** Additional company data for richer structured data */
  companyData?: CompanyDataProps
  /** Custom OG image URL */
  ogImage?: string
}

/**
 * Generate Schema.org Organization JSON-LD structured data
 * @see https://schema.org/Organization
 */
function generateOrganizationJsonLd(
  name: string,
  orgnr: string,
  url: string,
  data?: CompanyDataProps
): object {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    vatID: `NO${orgnr}MVA`,
    taxID: orgnr,
    url,
  }

  if (data?.hjemmeside) {
    jsonLd.sameAs = data.hjemmeside
  }

  if (data?.stiftelsesdato) {
    jsonLd.foundingDate = data.stiftelsesdato
  }

  if (data?.antall_ansatte && data.antall_ansatte > 0) {
    jsonLd.numberOfEmployees = {
      '@type': 'QuantitativeValue',
      value: data.antall_ansatte,
    }
  }

  if (data?.address?.postnummer) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      ...(data.address.adresse?.length && { streetAddress: data.address.adresse.join(', ') }),
      postalCode: data.address.postnummer,
      ...(data.address.poststed && { addressLocality: data.address.poststed }),
      addressCountry: data.address.land || 'NO',
    }
  }

  return jsonLd
}

/**
 * Generate Schema.org WebPage JSON-LD for the current page
 */
function generateWebPageJsonLd(title: string, description: string, url: string): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description,
    url,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Bedriftsgrafen.no',
      url: SEO_DEFAULTS.siteUrl,
    },
  }
}

/**
 * SEO metadata component using React 19's native <title> and <meta> hoisting
 * Includes JSON-LD structured data for improved search engine visibility
 */
export function SEOHead({
  companyName,
  orgnr,
  title: customTitle,
  description: customDescription,
  companyData,
  ogImage: customOgImage
}: SEOHeadProps) {
  const location = useLocation()
  
  // SEO optimization: Ensure canonical URL is strictly formatted
  // 1. Force the primary domain (SEO_DEFAULTS.siteUrl)
  // 2. Remove trailing slashes
  // 3. Remove query parameters (already handled by location.pathname)
  const cleanPath = location.pathname === '/' ? '' : location.pathname.replace(/\/$/, '')
  const currentUrl = `${SEO_DEFAULTS.siteUrl}${cleanPath}`

  const title = customTitle || (companyName
    ? `${getCompanyTitle(companyName)} (${orgnr})`
    : SEO_DEFAULTS.title)

  const description = customDescription || (companyName
    ? `Utforsk finansielle nøkkeltall, regnskap og bedriftsinformasjon for ${companyName} (org.nr: ${orgnr}). Gratis data fra Brønnøysundregistrene.`
    : SEO_DEFAULTS.description)

  // Memoize JSON-LD to avoid re-serialization on every render
  const webPageJsonLd = useMemo(
    () => JSON.stringify(generateWebPageJsonLd(title, description, currentUrl)),
    [title, description, currentUrl]
  )

  const organizationJsonLd = useMemo(
    () => companyName && orgnr
      ? JSON.stringify(generateOrganizationJsonLd(companyName, orgnr, currentUrl, companyData))
      : null,
    [companyName, orgnr, currentUrl, companyData]
  )

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content={currentUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content="Bedriftsgrafen.no" />
      <meta property="og:image" content={customOgImage || SEO_DEFAULTS.ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="Bedriftsgrafen.no - Analyse av norske bedrifter" />
      <meta property="og:locale" content="nb_NO" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={customOgImage || SEO_DEFAULTS.ogImage} />

      {/* Canonical URL */}
      <link rel="canonical" href={currentUrl} />

      {/* JSON-LD Structured Data */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: webPageJsonLd }} />
      {organizationJsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: organizationJsonLd }} />
      )}
    </>
  )
}
