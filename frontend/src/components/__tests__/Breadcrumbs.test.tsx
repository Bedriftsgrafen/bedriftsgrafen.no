import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Breadcrumbs } from '../Breadcrumbs'

// Mock TanStack Router Link
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to} itemProp="item">
      {children}
    </a>
  ),
}))

describe('Breadcrumbs SEO', () => {
  const mockItems = [
    { label: 'Hjem', to: '/' },
    { label: 'Bransjer', to: '/bransjer' },
    { label: 'Teknologi' },
  ]

  it('renders with correct Schema.org microdata attributes', () => {
    const { container } = render(<Breadcrumbs items={mockItems} />)

    // Check BreadcrumbList
    const nav = container.querySelector('nav')
    expect(nav).toHaveAttribute('itemScope')
    expect(nav).toHaveAttribute('itemType', 'https://schema.org/BreadcrumbList')

    // Check ListItems
    const listItems = container.querySelectorAll('li')
    expect(listItems).toHaveLength(3)
    listItems.forEach((li, index) => {
      expect(li).toHaveAttribute('itemProp', 'itemListElement')
      expect(li).toHaveAttribute('itemScope')
      expect(li).toHaveAttribute('itemType', 'https://schema.org/ListItem')

      // Check position meta
      const meta = li.querySelector('meta[itemProp="position"]')
      expect(meta).toHaveAttribute('content', (index + 1).toString())
    })
  })

  it('renders item names and links with correct microdata', () => {
    render(<Breadcrumbs items={mockItems} />)

    // Check links
    const homeLink = screen.getByText('Hjem')
    expect(homeLink.parentElement).toHaveAttribute('itemProp', 'item')
    
    // Check current page span
    const currentPage = screen.getByText('Teknologi')
    expect(currentPage).toHaveAttribute('itemProp', 'name')
  })
})
