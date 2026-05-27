import type { AriaAttributes, MouseEventHandler, ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Header } from '../Header'
import { useComparisonStore } from '../../../store/comparisonStore'

type MockSearch = {
  tab?: string
}

type MockLocation = {
  pathname: string
  search: MockSearch
  href: string
}

type MockLinkProps = {
  children: ReactNode
  to: string
  search?: MockSearch
  hash?: string
  className?: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  'aria-label'?: string
  'aria-current'?: AriaAttributes['aria-current']
}

const routerMock = vi.hoisted((): { location: MockLocation } => ({
  location: { pathname: '/', search: {}, href: '/' },
}))

function setRouterLocation(pathname: string, search: MockSearch = {}) {
  const searchString = search.tab ? `?tab=${search.tab}` : ''
  routerMock.location = {
    pathname,
    search,
    href: `${pathname}${searchString}`,
  }
}

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    search,
    hash,
    className,
    onClick,
    'aria-label': ariaLabel,
    'aria-current': ariaCurrent,
  }: MockLinkProps) => {
    const searchString = search?.tab ? `?tab=${search.tab}` : ''
    const hashString = hash ? `#${hash}` : ''

    return (
      <a
        href={`${to}${searchString}${hashString}`}
        className={className}
        onClick={onClick}
        aria-label={ariaLabel}
        aria-current={ariaCurrent}
      >
        {children}
      </a>
    )
  },
  useRouterState: () => ({ location: routerMock.location }),
}))

describe('Header', () => {
  beforeEach(() => {
    setRouterLocation('/')
    useComparisonStore.setState({ companies: [], isModalOpen: false })
  })

  it('renders a compact global header with menu controls', () => {
    render(<Header />)

    expect(screen.getByRole('banner')).toHaveClass('relative', 'z-2000')
    expect(screen.getByRole('link', { name: 'Bedriftsgrafen.no' })).toHaveAttribute('href', '/')
    expect(screen.getAllByRole('link', { name: 'Søk i databasen' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /Bytt tema/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Åpne meny' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('navigation', { name: 'Hurtigmeny' })).not.toBeInTheDocument()
  })

  it('opens a grouped quick menu that reaches every static site area', () => {
    render(<Header />)

    const menuButton = screen.getByRole('button', { name: 'Åpne meny' })
    fireEvent.click(menuButton)

    expect(menuButton).toHaveAttribute('aria-expanded', 'true')

    const menu = screen.getByRole('navigation', { name: 'Hurtigmeny' })
    expect(within(menu).getByRole('heading', { name: 'Søk og analyse' })).toBeInTheDocument()
    expect(within(menu).getByRole('heading', { name: 'Roller og personer' })).toBeInTheDocument()

    const expectedLinks = [
      ['Forside', '/'],
      ['Søk i databasen', '/utforsk'],
      ['Sammenlign virksomheter', '/sammenlign'],
      ['Kart', '/kart'],
      ['Bransjer', '/bransjer'],
      ['Bransjekart', '/bransjer?tab=map'],
      ['Bransjetopplister', '/bransjer?tab=toplist'],
      ['Søk virksomheter etter bransje', '/bransjer?tab=search'],
      ['Nyetableringer', '/nyetableringer'],
      ['Konkurser', '/konkurser'],
      ['Regioner', '/regioner'],
      ['Fylker', '/fylker'],
      ['Kommuner', '/kommuner'],
      ['Personer', '/person'],
      ['Personsøk', '/person?tab=sok'],
      ['Persontopplister', '/person?tab=topplister'],
      ['Om Bedriftsgrafen', '/om'],
      ['Datakilder', '/om#datakilder'],
    ]

    for (const [label, href] of expectedLinks) {
      expect(within(menu).getByRole('link', { name: label })).toHaveAttribute('href', href)
    }
  })

  it('shows a comparison count badge in header links when companies are selected', () => {
    useComparisonStore.setState({
      companies: [
        { orgnr: '923609016', navn: 'EQUINOR ASA' },
        { orgnr: '989795848', navn: 'AKER BP ASA' },
      ],
      isModalOpen: false,
    })

    render(<Header />)

    expect(screen.getAllByRole('link', { name: 'Sammenlign virksomheter (2 valgt)' }).length).toBeGreaterThan(0)
    expect(screen.getAllByText('2').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: 'Åpne meny' }))
    const menu = screen.getByRole('navigation', { name: 'Hurtigmeny' })

    expect(within(menu).getByRole('link', { name: 'Sammenlign virksomheter (2 valgt)' })).toBeInTheDocument()
  })

  it('closes the quick menu with Escape and restores focus to the menu button', () => {
    render(<Header />)

    const menuButton = screen.getByRole('button', { name: 'Åpne meny' })
    menuButton.focus()
    fireEvent.click(menuButton)

    expect(screen.getByRole('navigation', { name: 'Hurtigmeny' })).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('navigation', { name: 'Hurtigmeny' })).not.toBeInTheDocument()
    expect(menuButton).toHaveFocus()
    expect(menuButton).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes the quick menu when a menu link is activated', () => {
    render(<Header />)

    fireEvent.click(screen.getByRole('button', { name: 'Åpne meny' }))
    const menu = screen.getByRole('navigation', { name: 'Hurtigmeny' })

    fireEvent.click(within(menu).getByRole('link', { name: 'Konkurser' }))

    expect(screen.queryByRole('navigation', { name: 'Hurtigmeny' })).not.toBeInTheDocument()
  })

  it('closes the quick menu when the route changes', async () => {
    const view = render(<Header />)

    fireEvent.click(screen.getByRole('button', { name: 'Åpne meny' }))
    expect(screen.getByRole('navigation', { name: 'Hurtigmeny' })).toBeInTheDocument()

    setRouterLocation('/kart')
    view.rerender(<Header />)

    await waitFor(() => {
      expect(screen.queryByRole('navigation', { name: 'Hurtigmeny' })).not.toBeInTheDocument()
    })
  })
})