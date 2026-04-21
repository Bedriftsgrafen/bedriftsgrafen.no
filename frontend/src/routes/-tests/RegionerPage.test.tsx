import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ComponentType, ReactNode } from 'react'
import { RegionerPage } from '../regioner.lazy'
import { useCountiesListQuery } from '../../hooks/queries/useCountyQuery'
import { useMunicipalitiesListQuery } from '../../hooks/queries/useMunicipalityQuery'
import type { CountyListItem } from '../../types/county'
import type { MunicipalityListItem } from '../../types/municipality'

vi.mock('../../hooks/queries/useCountyQuery', () => ({
  useCountiesListQuery: vi.fn(),
}))

vi.mock('../../hooks/queries/useMunicipalityQuery', () => ({
  useMunicipalitiesListQuery: vi.fn(),
}))

vi.mock('../../components/layout', () => ({
  SEOHead: () => <div data-testid="seo-head" />,
  Breadcrumbs: ({ items }: { items: Array<{ label: string; to?: string }> }) => (
    <nav data-testid="breadcrumbs">
      {items.map(i => (
        <span key={i.label}>{i.label}</span>
      ))}
    </nav>
  ),
}))

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    createLazyFileRoute: () => (config: { component: ComponentType }) => ({
      component: config.component,
    }),
    Link: ({
      children,
      to,
      ...rest
    }: { children: ReactNode; to: string } & Record<string, unknown>) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  }
})

// Mock RegionCard to keep page-level tests focused
vi.mock('../../components/regions/RegionCard', () => ({
  RegionCard: ({
    name,
    kind,
    slug,
  }: {
    name: string
    kind: string
    slug: string
  }) => (
    <div data-testid={`region-card-${kind}`} data-slug={slug}>
      {name}
    </div>
  ),
}))

const makeCounty = (code: string, name: string, companyCount: number): CountyListItem => ({
  code,
  name,
  company_count: companyCount,
  municipality_count: 10,
  population: 100000,
  lat: 60.0,
  lng: 10.0,
})

const makeKommune = (
  code: string,
  name: string,
  companyCount: number,
): MunicipalityListItem => ({
  code,
  name,
  slug: `${code}-${name.toLowerCase()}`,
  company_count: companyCount,
  population: 10000,
  lat: 60.0,
  lng: 10.0,
})

// Build 3 counties and 25 municipalities for testing
const mockCounties = [
  makeCounty('03', 'Oslo', 90000),
  makeCounty('46', 'Vestland', 50000),
  makeCounty('11', 'Rogaland', 40000),
]
const mockMunicipalities = Array.from({ length: 25 }, (_, i) =>
  makeKommune(String(1000 + i).padStart(4, '0'), `Kommune${i}`, 1000 - i),
)

describe('RegionerPage', () => {
  const mockCountiesQuery = vi.mocked(useCountiesListQuery)
  const mockMunicipalitiesQuery = vi.mocked(useMunicipalitiesListQuery)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function setupReady() {
    mockCountiesQuery.mockReturnValue({
      data: mockCounties,
      isLoading: false,
    } as ReturnType<typeof useCountiesListQuery>)
    mockMunicipalitiesQuery.mockReturnValue({
      data: mockMunicipalities,
      isLoading: false,
    } as ReturnType<typeof useMunicipalitiesListQuery>)
  }

  it('renders H1 heading', () => {
    setupReady()
    render(<RegionerPage />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Regioner/)
  })

  it('renders breadcrumbs with Regioner label', () => {
    setupReady()
    render(<RegionerPage />)
    const bc = screen.getByTestId('breadcrumbs')
    expect(bc).toHaveTextContent('Regioner')
    expect(bc).toHaveTextContent('Hjem')
  })

  it('renders all 3 county cards', () => {
    setupReady()
    render(<RegionerPage />)
    const fylkeCards = screen.getAllByTestId('region-card-fylke')
    expect(fylkeCards).toHaveLength(3)
  })

  it('renders exactly 20 municipality cards (capped from 25)', () => {
    setupReady()
    render(<RegionerPage />)
    const kommuneCards = screen.getAllByTestId('region-card-kommune')
    expect(kommuneCards).toHaveLength(20)
  })

  it('"Vis alle" link points to /kommuner', () => {
    setupReady()
    render(<RegionerPage />)
    const visAlle = screen.getByTestId('vis-alle-link')
    expect(visAlle.getAttribute('href')).toBe('/kommuner')
  })

  it('"Vis alle" link text shows total municipality count', () => {
    setupReady()
    render(<RegionerPage />)
    expect(screen.getByTestId('vis-alle-link')).toHaveTextContent('Vis alle 25 kommuner')
  })

  it('shows loading spinner when counties are loading', () => {
    mockCountiesQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useCountiesListQuery>)
    mockMunicipalitiesQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as ReturnType<typeof useMunicipalitiesListQuery>)
    render(<RegionerPage />)
    expect(screen.queryAllByTestId('region-card-fylke')).toHaveLength(0)
  })

  it('renders Fylker section heading with count', () => {
    setupReady()
    render(<RegionerPage />)
    expect(screen.getByRole('heading', { name: /Fylker/ })).toBeInTheDocument()
    expect(screen.getByText('· 3')).toBeInTheDocument()
  })

  it('renders Kommuner section heading with counts', () => {
    setupReady()
    render(<RegionerPage />)
    expect(screen.getByRole('heading', { name: /Kommuner/ })).toBeInTheDocument()
    expect(screen.getByText(/topp 20 av 25/)).toBeInTheDocument()
  })

  it('search filters fylker by name', () => {
    setupReady()
    render(<RegionerPage />)
    const input = screen.getByTestId('region-search-input')
    fireEvent.change(input, { target: { value: 'Oslo' } })
    const fylkeCards = screen.getAllByTestId('region-card-fylke')
    expect(fylkeCards).toHaveLength(1)
    expect(fylkeCards[0]).toHaveTextContent('Oslo')
  })

  it('search filters kommuner by name', () => {
    setupReady()
    render(<RegionerPage />)
    const input = screen.getByTestId('region-search-input')
    fireEvent.change(input, { target: { value: 'Kommune0' } })
    const kommuneCards = screen.getAllByTestId('region-card-kommune')
    expect(kommuneCards).toHaveLength(1)
  })

  it('search with no matches shows empty state', () => {
    setupReady()
    render(<RegionerPage />)
    const input = screen.getByTestId('region-search-input')
    fireEvent.change(input, { target: { value: 'zzzz' } })
    expect(screen.getByTestId('empty-state')).toBeInTheDocument()
    expect(screen.queryAllByTestId('region-card-fylke')).toHaveLength(0)
    expect(screen.queryAllByTestId('region-card-kommune')).toHaveLength(0)
  })

  it('segment "fylker" hides kommuner section', () => {
    setupReady()
    render(<RegionerPage />)
    const btn = screen.getByTestId('segment-fylker')
    fireEvent.click(btn)
    expect(screen.queryAllByTestId('region-card-kommune')).toHaveLength(0)
    expect(screen.getAllByTestId('region-card-fylke').length).toBeGreaterThan(0)
  })

  it('segment "kommuner" hides fylker section', () => {
    setupReady()
    render(<RegionerPage />)
    const btn = screen.getByTestId('segment-kommuner')
    fireEvent.click(btn)
    expect(screen.queryAllByTestId('region-card-fylke')).toHaveLength(0)
    expect(screen.getAllByTestId('region-card-kommune').length).toBeGreaterThan(0)
  })

  it('"Vis alle" link hidden when search query is active', () => {
    setupReady()
    render(<RegionerPage />)
    const input = screen.getByTestId('region-search-input')
    fireEvent.change(input, { target: { value: 'Oslo' } })
    expect(screen.queryByTestId('vis-alle-link')).not.toBeInTheDocument()
  })

  it('Escape key clears the search query', () => {
    setupReady()
    render(<RegionerPage />)
    const input = screen.getByTestId('region-search-input')
    fireEvent.change(input, { target: { value: 'Oslo' } })
    expect((input as HTMLInputElement).value).toBe('Oslo')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('empty-state "Utforsk alle" link points to /utforsk', () => {
    setupReady()
    render(<RegionerPage />)
    const input = screen.getByTestId('region-search-input')
    fireEvent.change(input, { target: { value: 'zzzz' } })
    const utforskLink = screen.getByRole('link', { name: /Utforsk alle virksomheter/ })
    expect(utforskLink.getAttribute('href')).toBe('/utforsk')
  })

  it('mobile segment-select "fylker" hides kommuner section', () => {
    setupReady()
    render(<RegionerPage />)
    fireEvent.change(screen.getByTestId('segment-select'), { target: { value: 'fylker' } })
    expect(screen.queryAllByTestId('region-card-kommune')).toHaveLength(0)
    expect(screen.getAllByTestId('region-card-fylke').length).toBeGreaterThan(0)
  })

  it('kommuner heading shows "treff" count during active search', () => {
    setupReady()
    render(<RegionerPage />)
    const input = screen.getByTestId('region-search-input')
    // "Kommune1" matches exactly one municipality
    fireEvent.change(input, { target: { value: 'Kommune1' } })
    // Should show "· N treff" not "· topp N av M"
    expect(screen.getByRole('heading', { name: /Kommuner/ })).toBeInTheDocument()
    expect(screen.getByText(/treff/)).toBeInTheDocument()
  })
})
