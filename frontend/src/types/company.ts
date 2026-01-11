/**
 * Company-related types for Bedriftsgrafen.no
 */

export interface Address {
  adresse: string[]
  postnummer: string
  poststed: string
  land: string
  kommune?: string
  kommunenummer?: string  // 4-digit municipality code
}

export interface SubUnit {
  orgnr: string
  navn: string
  organisasjonsform: string
  beliggenhetsadresse?: Address
  postadresse?: Address
  antall_ansatte?: number
  naeringskode?: string
  stiftelsesdato?: string
}

export interface Naeringskode {
  kode: string
  beskrivelse: string
}

export interface Company {
  orgnr: string
  navn?: string
  organisasjonsform?: string
  naeringskode?: string
  naeringskoder?: Naeringskode[]
  updated_at?: string
  antall_ansatte?: number
  stiftelsesdato?: string
  hjemmeside?: string
  // Status flags
  konkurs?: boolean
  konkursdato?: string
  under_avvikling?: boolean
  under_tvangsavvikling?: boolean
  vedtektsfestet_formaal?: string
  // Latest financial data (if available)
  latest_revenue?: number | null
  latest_profit?: number | null
  latest_operating_margin?: number | null  // Operating margin as percentage
  postadresse?: Address
  forretningsadresse?: Address
  // Geocoding (from Kartverket API)
  latitude?: number | null
  longitude?: number | null
  geocoded_at?: string | null
  last_polled_regnskap?: string | null
}

export interface Accounting {
  id: number
  aar: number
  periode_fra?: string | null  // Fiscal period start (handles non-calendar years)
  periode_til?: string | null  // Fiscal period end
  total_inntekt: number | null
  aarsresultat: number | null
  egenkapital: number | null
  gjeldsgrad: number | null
  driftsresultat: number | null
  salgsinntekter: number | null
  omloepsmidler: number | null
  kortsiktig_gjeld: number | null
  avskrivninger: number | null
  sum_eiendeler?: number | null  // Total assets (anleggsmidler + omløpsmidler)
}

export interface Kpis {
  likviditetsgrad1: number | null
  ebitda: number | null
  ebitda_margin: number | null
  egenkapitalandel: number | null
  resultatgrad: number | null
  totalkapitalrentabilitet: number | null
}

export interface AccountingWithKpis extends Accounting {
  kpis: Kpis
}

export interface CompanyWithAccounting extends Company {
  regnskap: Accounting[]
}

export interface RecentCompany {
  orgnr: string
  navn: string
  organisasjonsform: string
  timestamp: number
}

export interface RecentSearch {
  query: string
  timestamp: number
  resultCount?: number
}
