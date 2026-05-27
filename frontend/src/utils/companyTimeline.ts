import type { Accounting, CompanyWithAccounting } from '../types'

export type CompanyTimelineTone = 'neutral' | 'positive' | 'warning' | 'critical' | 'info'

export interface CompanyTimelineEvent {
  id: string
  date: string
  title: string
  description: string
  source: string
  tone: CompanyTimelineTone
}

export interface CompanyFreshnessItem {
  id: string
  label: string
  value: string
  description: string
  source: string
  tone: CompanyTimelineTone
  valueType?: 'date' | 'text'
}

function normalizeIsoDate(value: string | null | undefined): string | null {
  if (!value) return null

  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return null

  return new Date(parsed).toISOString().slice(0, 10)
}

function getLatestAccounting(accounting: Accounting[] = []): Accounting | null {
  return accounting
    .filter((entry) => Number.isFinite(entry.aar))
    .sort((left, right) => {
      if (right.aar !== left.aar) return right.aar - left.aar
      return (normalizeIsoDate(right.periode_til)?.localeCompare(normalizeIsoDate(left.periode_til) ?? '') ?? 0)
    })[0] ?? null
}

export function buildCompanyTimelineEvents(company: CompanyWithAccounting): CompanyTimelineEvent[] {
  const events: CompanyTimelineEvent[] = []

  const addEvent = (event: CompanyTimelineEvent | null) => {
    if (event) events.push(event)
  }

  const konkursdato = normalizeIsoDate(company.konkursdato)
  addEvent(konkursdato ? {
    id: 'konkursdato',
    date: konkursdato,
    title: 'Konkurs registrert',
    description: 'Statusen kommer fra Enhetsregisteret og bør kontrolleres mot kilden ved juridisk bruk.',
    source: 'Brreg',
    tone: 'critical',
  } : null)

  const lastPolledRegnskap = normalizeIsoDate(company.last_polled_regnskap)
  addEvent(lastPolledRegnskap ? {
    id: 'last-polled-regnskap',
    date: lastPolledRegnskap,
    title: 'Regnskapsdata kontrollert',
    description: 'Bedriftsgrafen har kontrollert om nye regnskap er tilgjengelige.',
    source: 'Bedriftsgrafen',
    tone: 'info',
  } : null)

  const latestAccounting = getLatestAccounting(company.regnskap)
  const latestAccountingPeriodEnd = normalizeIsoDate(latestAccounting?.periode_til)
  addEvent(latestAccounting && latestAccountingPeriodEnd ? {
    id: `accounting-period-${latestAccounting.aar}`,
    date: latestAccountingPeriodEnd,
    title: `Regnskapsperiode ${latestAccounting.aar} avsluttet`,
    description: 'Regnskapet finnes i Bedriftsgrafen, men datoen er periodeavslutning, ikke innsendingsdato.',
    source: 'Regnskapsregisteret',
    tone: 'neutral',
  } : null)

  const registrertEnhetsregisteret = normalizeIsoDate(company.registreringsdato_enhetsregisteret)
  addEvent(registrertEnhetsregisteret ? {
    id: 'registreringsdato-enhetsregisteret',
    date: registrertEnhetsregisteret,
    title: 'Registrert i Enhetsregisteret',
    description: 'Offisiell registreringsdato for enheten.',
    source: 'Enhetsregisteret',
    tone: 'positive',
  } : null)

  const registrertForetaksregisteret = normalizeIsoDate(company.registreringsdato_foretaksregisteret)
  addEvent(registrertForetaksregisteret ? {
    id: 'registreringsdato-foretaksregisteret',
    date: registrertForetaksregisteret,
    title: 'Registrert i Foretaksregisteret',
    description: 'Vises for foretak som er registrert i Foretaksregisteret.',
    source: 'Foretaksregisteret',
    tone: 'positive',
  } : null)

  const stiftelsesdato = normalizeIsoDate(company.stiftelsesdato)
  addEvent(stiftelsesdato ? {
    id: 'stiftelsesdato',
    date: stiftelsesdato,
    title: 'Stiftet',
    description: 'Datoen foretaket er oppgitt stiftet.',
    source: 'Enhetsregisteret',
    tone: 'neutral',
  } : null)

  return events.sort((left, right) => right.date.localeCompare(left.date))
}

export function buildCompanyFreshnessItems(company: CompanyWithAccounting): CompanyFreshnessItem[] {
  const items: CompanyFreshnessItem[] = []
  const latestAccounting = getLatestAccounting(company.regnskap)

  items.push({
    id: 'company-source',
    label: 'Virksomhetsdata',
    value: company.updated_at ? normalizeIsoDate(company.updated_at) ?? 'Fra Enhetsregisteret' : 'Fra Enhetsregisteret',
    description: company.updated_at
      ? 'Kildedata har en egen oppdatert-dato fra Brreg.'
      : 'Datasettet vårt har foreløpig ingen pålitelig oppdatert-dato fra Brreg for enheten.',
    source: 'Enhetsregisteret',
    tone: company.updated_at ? 'positive' : 'warning',
    valueType: company.updated_at ? 'date' : 'text',
  })

  if (latestAccounting) {
    items.push({
      id: 'latest-accounting-year',
      label: 'Siste regnskapsår hos oss',
      value: `${latestAccounting.aar}`,
      description: 'Basert på regnskapsrader som er lagret i Bedriftsgrafen.',
      source: 'Regnskapsregisteret',
      tone: 'neutral',
      valueType: 'text',
    })
  }

  if (company.siste_innsendte_aarsregnskap) {
    items.push({
      id: 'siste-innsendte-aarsregnskap',
      label: 'Siste innsendte årsregnskap',
      value: company.siste_innsendte_aarsregnskap,
      description: 'Feltet kommer fra Brreg når det finnes i rådata for enheten.',
      source: 'Brreg',
      tone: 'neutral',
      valueType: 'text',
    })
  }

  const lastPolledRegnskap = normalizeIsoDate(company.last_polled_regnskap)
  if (lastPolledRegnskap) {
    items.push({
      id: 'last-polled-regnskap',
      label: 'Regnskap sist kontrollert',
      value: lastPolledRegnskap,
      description: 'Dette er tidspunktet Bedriftsgrafen kontrollerte kilden, ikke offisiell innsendingsdato.',
      source: 'Bedriftsgrafen',
      tone: 'info',
      valueType: 'date',
    })
  }

  const geocodedAt = normalizeIsoDate(company.geocoded_at)
  if (geocodedAt) {
    items.push({
      id: 'geocoded-at',
      label: 'Adresse kartfestet',
      value: geocodedAt,
      description: 'Kartposisjon er beregnet fra registrert adresse når koordinater er tilgjengelige.',
      source: 'Kartverket',
      tone: 'info',
      valueType: 'date',
    })
  }

  return items
}