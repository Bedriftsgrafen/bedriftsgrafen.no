// Format number with Norwegian locale (no decimals)
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '—'
  return new Intl.NumberFormat('nb-NO').format(Math.round(num))
}

/**
 * Strips any literal quote characters from an organization number.
 * Useful for handling URL parameters that might be serialized with quotes.
 */
export function cleanOrgnr(orgnr: string | null | undefined): string | null {
  if (!orgnr) return null
  return orgnr.toString().replace(/"/g, '')
}

/**
 * Removes common organization suffixes (AS, ASA, etc.) from a company name.
 * Useful for improving search results on external platforms like LinkedIn.
 */
export function cleanCompanyNameForSearch(name: string | null | undefined): string {
  if (!name) return ''

  // List of suffixes to remove, sorted by length descending to avoid partial matches
  const suffixes = [
    'aksjeselskap', 'allmennaksjeselskap', 'enkeltpersonforetak',
    'forening', 'stiftelse', 'borettslag',
    'asa', 'ans', 'da', 'enk', 'nuf', 'iks', 'as', 'ks', 'sa', 'kf', 'ba', 'brl', 'sf', 'sti'
  ]

  const regex = new RegExp(`\\s+(${suffixes.join('|')})$`, 'i')
  return name.replace(regex, '').trim()
}

/**
 * Generates a LinkedIn search URL for a company or person.
 */
export function getLinkedInSearchUrl(name: string | null | undefined, type: 'company' | 'person'): string {
  if (!name) return '#'

  const query = type === 'company' ? cleanCompanyNameForSearch(name) : name
  const path = type === 'company' ? 'companies' : 'people'

  return `https://www.linkedin.com/search/results/${path}/?keywords=${encodeURIComponent(query)}`
}

/**
 * Generates a URL for the official Enhetsregisteret entry at Brønnøysundregistrene.
 */
export function getBrregEnhetsregisteretUrl(orgnr: string | null | undefined): string {
  if (!orgnr) return '#'
  return `https://data.brreg.no/enhetsregisteret/oppslag/enheter/${orgnr.replace(/\s/g, '')}`
}

/**
 * Generates a 1881.no person search URL.
 */
export function get1881SearchUrl(name: string | null | undefined): string {
  if (!name) return '#'
  return `https://www.1881.no/?query=${encodeURIComponent(name)}&type=person`
}

/**
 * Generates a URL for the Brreg konsern (group) view.
 */
export function getBrregKonsernUrl(orgnr: string | null | undefined): string {
  if (!orgnr) return '#'
  // Use virksomhet.brreg.no which handles konsern display properly via search with orgnr
  return `https://virksomhet.brreg.no/nb/oppslag/enheter?orgnr=${orgnr.replace(/\s/g, '')}`
}

// Format currency with smart abbreviations (mill, mrd)
export function formatCurrency(num: number | null | undefined): string {
  if (num === null || num === undefined) return '—'
  if (Math.abs(num) >= 1e12) return `${(num / 1e12).toFixed(1)} bill`
  if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(1)} mrd`
  if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(0)} mill`
  return formatNumber(num)
}

// Format Norwegian currency
export function formatNOK(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// Format percentage
export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return '-'
  return `${(value * 100).toFixed(decimals)}%`
}

// Format percentage value (when value is already a percentage, e.g., 7.3 for 7.3%)
export function formatPercentValue(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined) return '-'
  return `${value.toFixed(decimals)}%`
}

// Format large numbers (thousand, million, billion, trillion)
export function formatLargeNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'

  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(1)} bill.`
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} milliard`
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)} mill.`
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)} k`
  }
  return formatNumber(value)
}

// Format large currency (TNOK, MNOK)
export function formatLargeCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-'

  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} mrd. kr`
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString('nb-NO', { maximumFractionDigits: 1 })} mill. kr`
  }
  // For thousands and below, show the full number for maximum clarity
  return `${formatNumber(value)} kr`
}

// Format time distance (e.g., "2 minutes ago")
export function formatDistanceToNow(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days} dag${days > 1 ? 'er' : ''} siden`
  } else if (hours > 0) {
    return `${hours} time${hours > 1 ? 'r' : ''} siden`
  } else if (minutes > 0) {
    return `${minutes} minutt${minutes > 1 ? 'er' : ''} siden`
  } else {
    return 'nettopp'
  }
}

// Get KPI description in Norwegian
export function getKpiDescription(key: string): { name: string; description: string } {
  const descriptions: Record<string, { name: string; description: string }> = {
    likviditetsgrad1: {
      name: 'Likviditetsgrad 1',
      description: 'Omløpsmidler / Kortsiktig gjeld. Måler evne til å betale kortsiktig gjeld.'
    },
    ebitda: {
      name: 'EBITDA',
      description: 'Driftsresultat + Avskrivninger. Kontantstrøm fra drift.'
    },
    ebitda_margin: {
      name: 'EBITDA-margin',
      description: 'EBITDA / Salgsinntekter. Lønnsomhet før avskrivninger.'
    },
    egenkapitalandel: {
      name: 'Egenkapitalandel',
      description: 'Egenkapital / Totalkapital. Finansiell soliditet.'
    },
    resultatgrad: {
      name: 'Resultatgrad',
      description: 'Årsresultat / Salgsinntekter. Netto fortjenestemargin.'
    },
    totalkapitalrentabilitet: {
      name: 'Totalkapitalrentabilitet',
      description: 'Årsresultat / Sum eiendeler. Avkastning på totale eiendeler.'
    },
  }

  return descriptions[key] || { name: key, description: '' }
}

// Format date to Norwegian format
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-'

  try {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('nb-NO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date)
  } catch {
    return '-'
  }
}

/**
 * Normalizes text by collapsing multiple spaces and single newlines into a single space,
 * while preserving double newlines as intentional paragraph breaks.
 * Ideal for cleaning up legacy fixed-width data from official registers.
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return ''

  return text
    .split(/\n\s*\n/) // Split into potential paragraphs
    .map(paragraph => paragraph.replace(/\s+/g, ' ').trim()) // Collapse all whitespace within paragraph to spaces
    .join('\n\n') // Restore paragraph breaks
}

// Get color for KPI value (good/warning/bad)
export function getKpiColor(key: string, value: number | null): string {
  if (value === null) return 'text-gray-400'

  switch (key) {
    case 'likviditetsgrad1':
      if (value >= 2) return 'text-green-700'
      if (value >= 1) return 'text-yellow-800'
      return 'text-red-700'

    case 'ebitda_margin':
    case 'resultatgrad':
      if (value >= 0.1) return 'text-green-700'
      if (value >= 0.05) return 'text-yellow-800'
      return 'text-red-700'

    case 'egenkapitalandel':
      if (value >= 0.3) return 'text-green-700'
      if (value >= 0.2) return 'text-yellow-800'
      return 'text-red-700'

    case 'totalkapitalrentabilitet':
      if (value >= 0.1) return 'text-green-700'
      if (value >= 0.05) return 'text-yellow-800'
      return 'text-red-700'

    default:
      return 'text-gray-700'
  }
}
