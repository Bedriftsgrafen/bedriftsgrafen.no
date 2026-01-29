/**
 * URL slug utilities for Norwegian text.
 * Converts special Norwegian characters and creates URL-safe slugs.
 */

const NORWEGIAN_CHAR_MAP: Record<string, string> = {
  'æ': 'ae',
  'ø': 'o',
  'å': 'a',
  'Æ': 'ae',
  'Ø': 'o',
  'Å': 'a',
}

/**
 * Convert Norwegian characters to ASCII equivalents.
 */
export function norwegianToAscii(text: string): string {
  return text.replace(/[æøåÆØÅ]/g, (char) => NORWEGIAN_CHAR_MAP[char] || char)
}

/**
 * Create a URL-safe slug from text.
 * Handles Norwegian characters and spaces.
 *
 * @example
 * slugify("Møre og Romsdal") // "more-og-romsdal"
 * slugify("Oslo") // "oslo"
 */
export function slugify(text: string): string {
  return norwegianToAscii(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
}

/**
 * Create a route-friendly code with name slug.
 * Format: "{code}-{slugified-name}"
 *
 * @example
 * createRouteCode("46", "Vestland") // "46-vestland"
 * createRouteCode("4601", "Bergen") // "4601-bergen"
 * createRouteCode("15", "Møre og Romsdal") // "15-more-og-romsdal"
 */
export function createRouteCode(code: string, name: string): string {
  return `${code}-${slugify(name)}`
}

/**
 * Extract the numeric code from a route code string.
 * Handles both formats: "46" or "46-vestland"
 *
 * @example
 * extractCode("46-vestland") // "46"
 * extractCode("4601-bergen") // "4601"
 * extractCode("46") // "46"
 */
export function extractCode(routeCode: string): string {
  const dashIndex = routeCode.indexOf('-')
  return dashIndex > 0 ? routeCode.slice(0, dashIndex) : routeCode
}
