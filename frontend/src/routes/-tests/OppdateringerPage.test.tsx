import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OppdateringerPage } from '../../components/updates/OppdateringerPage'
import { useActivityOverviewQuery } from '../../hooks/queries/useActivityOverviewQuery'

vi.mock('@tanstack/react-router', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Link: ({ children, to, params }: any) => {
    const href = params?.orgnr ? `/virksomhet/${params.orgnr}` : to
    return <a href={href}>{children}</a>
  },
}))

vi.mock('../../components/layout', () => ({
  SEOHead: () => <div data-testid="seo-head" />,
}))

vi.mock('../../hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}))

vi.mock('../../hooks/queries/useActivityOverviewQuery', () => ({
  useActivityOverviewQuery: vi.fn(),
}))

const overviewResponse = {
  generated_at: '2026-05-27T14:30:00Z',
  cache_ttl_seconds: 120,
  new_companies: {
    id: 'new_companies' as const,
    title: 'Nye virksomheter',
    description: 'Nyeste registreringer.',
    source: 'Enhetsregisteret via Brreg',
    time_label: 'Registreringsdato',
    items: [
      {
        orgnr: '123456789',
        navn: 'Test Bedrift AS',
        organisasjonsform: 'AS',
        naeringskode: '62.010',
        antall_ansatte: 12,
        event_date: '2026-05-27',
        event_label: 'Registrert i Enhetsregisteret',
        source: 'Enhetsregisteret via Brreg',
        time_semantics: 'Kildedato fra Enhetsregisteret.',
      },
    ],
  },
  bankruptcies: {
    id: 'bankruptcies' as const,
    title: 'Konkurser og avvikling',
    description: 'Nyeste konkurser.',
    source: 'Enhetsregisteret via Brreg',
    time_label: 'Konkursdato',
    items: [],
  },
  data_status: [
    {
      key: 'company_update_last_sync_date',
      title: 'Enhetsregisteret',
      description: 'Siste dato Bedriftsgrafen har synket.',
      value: '2026-05-27',
      updated_at: '2026-05-27T14:04:00Z',
      source: 'Brreg oppdateringsstrøm',
    },
  ],
  deferred_feeds: [
    {
      id: 'accounting_updates' as const,
      title: 'Nye regnskap hos Bedriftsgrafen',
      reason: 'Regnskapstabellen mangler i dag en trygg indeks for siste oppdatering.',
      requirement: 'Legg til indeks eller eventlogg før offentlig feed.',
    },
  ],
}

describe('OppdateringerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(useActivityOverviewQuery).mockReturnValue({ data: overviewResponse, isLoading: false, error: null } as any)
  })

  it('renders indexed feeds and deferred accounting copy', () => {
    render(<OppdateringerPage />)

    expect(screen.getByTestId('seo-head')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Siste oppdateringer/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Nye virksomheter/i })).toBeInTheDocument()
    expect(screen.getByText(/Test Bedrift AS/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Test Bedrift AS/i })).toHaveAttribute('href', '/virksomhet/123456789')
    expect(screen.getByText(/Regnskapsoppdateringer venter/i)).toBeInTheDocument()
    expect(screen.getByText(/mangler i dag en trygg indeks/i)).toBeInTheDocument()
  })

  it('can render the data status tab without activity rows', () => {
    render(<OppdateringerPage activeTab="datastatus" />)

    expect(screen.getByRole('heading', { name: /Datastatus/i })).toBeInTheDocument()
    expect(screen.getByText(/Brreg oppdateringsstrøm/i)).toBeInTheDocument()
    expect(screen.queryByText(/Test Bedrift AS/i)).not.toBeInTheDocument()
  })
})
