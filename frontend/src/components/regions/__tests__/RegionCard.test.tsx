import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RegionCard } from '../RegionCard'

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    className,
  }: {
    children: React.ReactNode
    to: string
    params?: Record<string, string>
    className?: string
  }) => (
    <a href={`${to}/${params?.code ?? ''}`} className={className} data-testid="region-link">
      {children}
    </a>
  ),
}))

vi.mock('../../../utils/mapTiles', () => ({
  getStaticMapUrl: (lat: number, lng: number, zoom: number) =>
    `https://mock-tiles/${lat}/${lng}/${zoom}/light_nolabels`,
}))

describe('RegionCard – kind fylke', () => {
  const props = {
    kind: 'fylke' as const,
    code: '46',
    name: 'Vestland',
    slug: '46-vestland',
    companyCount: 42000,
    population: 635000,
    municipalityCount: 43,
    lat: 60.4,
    lng: 5.3,
  }

  it('renders the county name as a heading', () => {
    render(<RegionCard {...props} />)
    expect(screen.getByRole('heading', { name: 'Vestland' })).toBeInTheDocument()
  })

  it('links to the fylke route with correct slug', () => {
    render(<RegionCard {...props} />)
    const link = screen.getByTestId('region-link')
    expect(link.getAttribute('href')).toBe('/fylke/$code/46-vestland')
  })

  it('shows municipality count subtitle', () => {
    render(<RegionCard {...props} />)
    expect(screen.getByText('43 kommuner')).toBeInTheDocument()
  })

  it('shows "Utforsk fylket" CTA', () => {
    render(<RegionCard {...props} />)
    expect(screen.getByText('Utforsk fylket')).toBeInTheDocument()
  })

  it('renders map background with correct zoom level 9', () => {
    render(<RegionCard {...props} />)
    // There is no data-testid on the fylke map div, so we check via backgroundImage on children
    const link = screen.getByTestId('region-link')
    const mapDiv = link.querySelector('[style*="background-image"]') as HTMLElement | null
    expect(mapDiv?.style.backgroundImage).toContain('/9/')
  })

  it('does not render data-testid on map for fylke', () => {
    render(<RegionCard {...props} />)
    expect(screen.queryByTestId('municipality-map-46')).not.toBeInTheDocument()
  })
})

describe('RegionCard – kind kommune', () => {
  const props = {
    kind: 'kommune' as const,
    code: '3240',
    name: 'Eidsvoll',
    slug: '3240-eidsvoll',
    companyCount: 1823,
    population: 25000,
    lat: 60.3,
    lng: 11.2,
  }

  it('renders the municipality name as a heading', () => {
    render(<RegionCard {...props} />)
    expect(screen.getByRole('heading', { name: 'Eidsvoll' })).toBeInTheDocument()
  })

  it('links to the kommune route with correct slug', () => {
    render(<RegionCard {...props} />)
    const link = screen.getByTestId('region-link')
    expect(link.getAttribute('href')).toBe('/kommune/$code/3240-eidsvoll')
  })

  it('does not show "Utforsk fylket" CTA', () => {
    render(<RegionCard {...props} />)
    expect(screen.queryByText('Utforsk fylket')).not.toBeInTheDocument()
  })

  it('renders data-testid on map background div', () => {
    render(<RegionCard {...props} />)
    const mapDiv = screen.getByTestId('municipality-map-3240')
    expect(mapDiv).toBeInTheDocument()
    expect(mapDiv.style.backgroundImage).toContain('light_nolabels')
  })

  it('renders map background with correct zoom level 11', () => {
    render(<RegionCard {...props} />)
    const mapDiv = screen.getByTestId('municipality-map-3240')
    expect(mapDiv.style.backgroundImage).toContain('/11/')
  })

  it('shows company count', () => {
    render(<RegionCard {...props} />)
    // formatNumber(1823) → "1 823" in nb-NO locale (space variant depends on environment)
    expect(screen.getByText(/1.823/)).toBeInTheDocument()
  })
})

describe('RegionCard – municipality count singular', () => {
  it('shows "1 kommune" for municipalityCount=1', () => {
    render(
      <RegionCard
        kind="fylke"
        code="99"
        name="TestFylke"
        slug="99-testfylke"
        companyCount={1}
        municipalityCount={1}
      />,
    )
    expect(screen.getByText('1 kommune')).toBeInTheDocument()
  })
})
