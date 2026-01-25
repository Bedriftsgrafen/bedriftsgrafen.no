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
  naeringskode?: string | Naeringskode
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
  naeringskode?: string | Naeringskode
  naeringskoder?: Naeringskode[]
  updated_at?: string
  antall_ansatte?: number
  stiftelsesdato?: string
  hjemmeside?: string
  // Contact info (from raw_data)
  telefon?: string
  mobil?: string
  epostadresse?: string
  // Status flags
  konkurs?: boolean
  konkursdato?: string
  under_avvikling?: boolean
  under_tvangsavvikling?: boolean
  registrert_i_foretaksregisteret?: boolean
  registrert_i_mvaregisteret?: boolean
  registrert_i_frivillighetsregisteret?: boolean
  registrert_i_stiftelsesregisteret?: boolean
  registrert_i_partiregisteret?: boolean
  registreringsdato_enhetsregisteret?: string
  registreringsdato_foretaksregisteret?: string
  vedtektsfestet_formaal?: string
  // Capital info (from raw_data)
  aksjekapital?: number
  antall_aksjer?: number
  er_i_konsern?: boolean
  siste_innsendte_aarsregnskap?: string
  institusjonell_sektor?: string
  // Latest financial data (if available)
  latest_revenue?: number | null
  latest_profit?: number | null
  latest_operating_profit?: number | null
  latest_operating_margin?: number | null  // Operating margin as percentage
  latest_equity_ratio?: number | null  // Equity ratio as decimal (0.0 - 1.0)
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
