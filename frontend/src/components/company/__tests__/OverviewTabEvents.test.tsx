import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { OverviewTab } from '../OverviewTab'
import { useCompanyEventsQuery } from '../../../hooks/queries/useCompanyEventsQuery'
import type { CompanyWithAccounting } from '../../../types'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, className, title }: { children: ReactNode; className?: string; title?: string }) => (
    <a href="#" className={className} title={title}>{children}</a>
  ),
}))

vi.mock('../../common/LocationMap', () => ({
  LocationMap: () => <div data-testid="mock-location-map" />,
}))

vi.mock('../../ads/AffiliateBanner', () => ({
  AffiliateBanner: () => <div data-testid="mock-affiliate-banner" />,
}))

vi.mock('../../../hooks/queries/useCompanyEventsQuery', () => ({
  useCompanyEventsQuery: vi.fn(),
}))

const mockedUseCompanyEventsQuery = vi.mocked(useCompanyEventsQuery)

const company: CompanyWithAccounting = {
  orgnr: '989476130',
  navn: 'Scandinavian Wheel AS',
  organisasjonsform: 'AS',
  naeringskode: '45.320',
  stiftelsesdato: '2005-01-14',
  registreringsdato_enhetsregisteret: '2005-02-01',
  regnskap: [
    {
      id: 1,
      aar: 2025,
      periode_til: '2025-12-31',
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
}

function queryResult(overrides: Partial<ReturnType<typeof useCompanyEventsQuery>> = {}) {
  return {
    data: undefined,
    isLoading: false,
    error: null,
    ...overrides,
  } as ReturnType<typeof useCompanyEventsQuery>
}

describe('OverviewTab event ledger', () => {
  beforeEach(() => {
    mockedUseCompanyEventsQuery.mockReset()
  })

  it('renders recent company events from the event ledger', () => {
    mockedUseCompanyEventsQuery.mockReturnValue(queryResult({
      data: {
        generated_at: '2026-05-28T06:00:00Z',
        cache_ttl_seconds: 300,
        orgnr: '989476130',
        limit: 6,
        offset: 0,
        has_more: true,
        events: [
          {
            id: 3484,
            orgnr: '989476130',
            event_type: 'accounting_added',
            title: 'Regnskap lagt til',
            source: 'Regnskapsregisteret via Brreg',
            source_update_id: '6382335',
            occurred_at: '2025-12-31T00:00:00Z',
            observed_at: '2026-05-28T05:18:43.765137Z',
            time_semantics: 'Kildetidspunkt når kilden oppgir det.',
            previous_value: null,
            new_value: { aar: 2025, periode_til: '2025-12-31' },
            payload: { journalnr: '2026323049' },
          },
        ],
      },
    }))

    render(<OverviewTab company={company} />)

    expect(mockedUseCompanyEventsQuery).toHaveBeenCalledWith('989476130', 6)
    expect(screen.getByText('Siste hendelser')).toBeInTheDocument()
    expect(screen.getByText('Regnskap 2025 lagt til')).toBeInTheDocument()
    expect(screen.getByText(/Regnskapsperioden slutter/)).toBeInTheDocument()
    expect(screen.getByText(/Regnskapsregisteret via Brreg/)).toBeInTheDocument()
    expect(screen.getByText('Flere hendelser finnes i eventloggen.')).toBeInTheDocument()
  })

  it('keeps kildedatoer visible when no event ledger rows exist yet', () => {
    mockedUseCompanyEventsQuery.mockReturnValue(queryResult({
      data: {
        generated_at: '2026-05-28T06:00:00Z',
        cache_ttl_seconds: 300,
        orgnr: '989476130',
        limit: 6,
        offset: 0,
        has_more: false,
        events: [],
      },
    }))

    render(<OverviewTab company={company} />)

    expect(screen.getByText('Ingen eventlogg-hendelser er registrert for denne virksomheten ennå.')).toBeInTheDocument()
    expect(screen.getByText('Viktige kildedatoer')).toBeInTheDocument()
    expect(screen.getByText('Registrert i Enhetsregisteret')).toBeInTheDocument()
  })
})