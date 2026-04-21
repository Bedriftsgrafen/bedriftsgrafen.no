import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RegionFilterBar } from '../RegionFilterBar'

function renderBar(overrides: Partial<Parameters<typeof RegionFilterBar>[0]> = {}) {
  const defaults = {
    searchQuery: '',
    segment: 'all' as const,
    onSearchChange: vi.fn(),
    onSegmentChange: vi.fn(),
    searchRef: { current: null },
  }
  const props = { ...defaults, ...overrides }
  render(<RegionFilterBar {...props} />)
  return props
}

describe('RegionFilterBar', () => {
  it('renders search input with correct placeholder', () => {
    renderBar()
    expect(screen.getByTestId('region-search-input')).toBeInTheDocument()
  })

  it('reflects searchQuery value in the input', () => {
    renderBar({ searchQuery: 'Oslo' })
    expect((screen.getByTestId('region-search-input') as HTMLInputElement).value).toBe('Oslo')
  })

  it('calls onSearchChange when input changes', () => {
    const { onSearchChange } = renderBar()
    fireEvent.change(screen.getByTestId('region-search-input'), { target: { value: 'Bergen' } })
    expect(onSearchChange).toHaveBeenCalledWith('Bergen')
  })

  it('desktop segment "Fylker" button calls onSegmentChange', () => {
    const { onSegmentChange } = renderBar()
    fireEvent.click(screen.getByTestId('segment-fylker'))
    expect(onSegmentChange).toHaveBeenCalledWith('fylker')
  })

  it('desktop segment "Kommuner" button calls onSegmentChange', () => {
    const { onSegmentChange } = renderBar()
    fireEvent.click(screen.getByTestId('segment-kommuner'))
    expect(onSegmentChange).toHaveBeenCalledWith('kommuner')
  })

  it('desktop segment "Alle" button calls onSegmentChange', () => {
    const { onSegmentChange } = renderBar({ segment: 'fylker' })
    fireEvent.click(screen.getByTestId('segment-all'))
    expect(onSegmentChange).toHaveBeenCalledWith('all')
  })

  it('mobile select calls onSegmentChange on change', () => {
    const { onSegmentChange } = renderBar()
    fireEvent.change(screen.getByTestId('segment-select'), { target: { value: 'kommuner' } })
    expect(onSegmentChange).toHaveBeenCalledWith('kommuner')
  })
})
