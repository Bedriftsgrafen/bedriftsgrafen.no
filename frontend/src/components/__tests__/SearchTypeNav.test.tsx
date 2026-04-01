import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SearchTypeNav } from '../common/SearchTypeNav'

// Mock TanStack Router Link
vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, to, search, className, ...rest }: {
        children: React.ReactNode
        to: string
        search?: Record<string, string>
        className?: string
        'aria-current'?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false' | boolean
    }) => (
        <a href={to} className={className} aria-current={rest['aria-current']} data-search={JSON.stringify(search)}>
            {children}
        </a>
    ),
}))

describe('SearchTypeNav', () => {
    it('renders both tabs', () => {
        render(<SearchTypeNav active="virksomheter" />)
        expect(screen.getByText('Virksomheter')).toBeInTheDocument()
        expect(screen.getByText('Personer')).toBeInTheDocument()
    })

    it('marks virksomheter as active when selected', () => {
        render(<SearchTypeNav active="virksomheter" />)
        const virksomheterLink = screen.getByText('Virksomheter').closest('a')
        expect(virksomheterLink).toHaveAttribute('aria-current', 'page')

        const personerLink = screen.getByText('Personer').closest('a')
        expect(personerLink).not.toHaveAttribute('aria-current')
    })

    it('marks personer as active when selected', () => {
        render(<SearchTypeNav active="personer" />)
        const personerLink = screen.getByText('Personer').closest('a')
        expect(personerLink).toHaveAttribute('aria-current', 'page')
    })

    it('passes query parameter to links', () => {
        render(<SearchTypeNav active="virksomheter" query="test" />)
        const personerLink = screen.getByText('Personer').closest('a')
        expect(personerLink?.getAttribute('data-search')).toContain('"q":"test"')
    })

    it('renders navigation landmark', () => {
        render(<SearchTypeNav active="virksomheter" />)
        const nav = screen.getByRole('navigation', { name: 'Søketype' })
        expect(nav).toBeInTheDocument()
    })
})
