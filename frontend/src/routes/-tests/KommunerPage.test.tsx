import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ComponentType, ReactNode } from 'react'
import { KommunerPage } from '../kommuner.lazy'
import { useMunicipalitiesListQuery } from '../../hooks/queries/useMunicipalityQuery'

vi.mock('../../hooks/queries/useMunicipalityQuery', () => ({
  useMunicipalitiesListQuery: vi.fn(),
}))

vi.mock('../../components/layout', () => ({
  SEOHead: () => <div data-testid="seo-head" />,
  Breadcrumbs: () => <div data-testid="breadcrumbs" />,
}))

vi.mock('@tanstack/react-router', async () => {
  const actual = await vi.importActual('@tanstack/react-router')
  return {
    ...actual,
    createLazyFileRoute: () => (config: { component: ComponentType }) => ({ component: config.component }),
    Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  }
})

describe('KommunerPage', () => {
  const mockUseMunicipalitiesListQuery = vi.mocked(useMunicipalitiesListQuery)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders municipality cards with map background', () => {
    mockUseMunicipalitiesListQuery.mockReturnValue({
      data: [
        {
          code: '0301',
          name: 'Oslo',
          slug: '0301-oslo',
          company_count: 10,
          population: 100,
          lat: 59.9,
          lng: 10.7,
        },
      ],
      isLoading: false,
    } as ReturnType<typeof useMunicipalitiesListQuery>)

    render(<KommunerPage />)

    expect(screen.getByRole('heading', { name: 'Oslo' })).toBeInTheDocument()

    const map = screen.getByTestId('municipality-map-0301')
    expect(map.style.backgroundImage).toContain('light_nolabels')
  })
})
