import { describe, expect, it } from 'vitest'
import type { CompanyWithAccounting } from '../../types'
import { buildCompanyFreshnessItems, buildCompanyTimelineEvents } from '../companyTimeline'

const baseCompany: CompanyWithAccounting = {
  orgnr: '123456789',
  navn: 'Test AS',
  organisasjonsform: 'AS',
  regnskap: [],
}

describe('companyTimeline', () => {
  it('builds dated events from trustworthy existing company fields', () => {
    const events = buildCompanyTimelineEvents({
      ...baseCompany,
      stiftelsesdato: '2019-02-01',
      registreringsdato_enhetsregisteret: '2019-02-12',
      registreringsdato_foretaksregisteret: '2019-02-20',
      last_polled_regnskap: '2026-05-27',
      regnskap: [
        {
          id: 1,
          aar: 2024,
          periode_til: '2024-12-31',
          total_inntekt: null,
          aarsresultat: null,
          egenkapital: null,
          gjeldsgrad: null,
          driftsresultat: null,
          salgsinntekter: null,
          omloepsmidler: null,
          kortsiktig_gjeld: null,
          avskrivninger: null,
        },
      ],
    })

    expect(events.map((event) => event.id)).toEqual([
      'last-polled-regnskap',
      'accounting-period-2024',
      'registreringsdato-foretaksregisteret',
      'registreringsdato-enhetsregisteret',
      'stiftelsesdato',
    ])
    expect(events[0]).toMatchObject({
      title: 'Regnskapsdata kontrollert',
      source: 'Bedriftsgrafen',
      tone: 'info',
    })
    expect(events.find((event) => event.id === 'accounting-period-2024')?.description).toContain('ikke innsendingsdato')
  })

  it('does not invent accounting event dates when only accounting year is available', () => {
    const events = buildCompanyTimelineEvents({
      ...baseCompany,
      regnskap: [
        {
          id: 1,
          aar: 2025,
          total_inntekt: null,
          aarsresultat: null,
          egenkapital: null,
          gjeldsgrad: null,
          driftsresultat: null,
          salgsinntekter: null,
          omloepsmidler: null,
          kortsiktig_gjeld: null,
          avskrivninger: null,
        },
      ],
    })

    expect(events.some((event) => event.id.startsWith('accounting-period'))).toBe(false)
  })

  it('marks bankruptcy as critical when a dated bankruptcy status exists', () => {
    const events = buildCompanyTimelineEvents({
      ...baseCompany,
      konkurs: true,
      konkursdato: '2026-04-03',
      stiftelsesdato: '2020-01-01',
    })

    expect(events[0]).toMatchObject({
      id: 'konkursdato',
      title: 'Konkurs registrert',
      tone: 'critical',
    })
  })

  it('builds freshness items without pretending Brreg updated_at exists', () => {
    const freshnessItems = buildCompanyFreshnessItems({
      ...baseCompany,
      siste_innsendte_aarsregnskap: '2024',
      last_polled_regnskap: '2026-05-27',
      regnskap: [
        {
          id: 1,
          aar: 2024,
          total_inntekt: null,
          aarsresultat: null,
          egenkapital: null,
          gjeldsgrad: null,
          driftsresultat: null,
          salgsinntekter: null,
          omloepsmidler: null,
          kortsiktig_gjeld: null,
          avskrivninger: null,
        },
      ],
    })

    expect(freshnessItems.find((item) => item.id === 'company-source')).toMatchObject({
      value: 'Fra Enhetsregisteret',
      tone: 'warning',
    })
    expect(freshnessItems.find((item) => item.id === 'latest-accounting-year')?.value).toBe('2024')
    expect(freshnessItems.find((item) => item.id === 'last-polled-regnskap')).toMatchObject({
      value: '2026-05-27',
      source: 'Bedriftsgrafen',
    })
  })
})