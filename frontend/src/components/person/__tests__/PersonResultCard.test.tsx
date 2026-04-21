import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PersonResultCard } from '../PersonResultCard'
import type { PersonSearchResultDetailed } from '../../../types/person'

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, to, params, className }: {
        children: React.ReactNode
        to: string
        params?: Record<string, string>
        className?: string
    }) => (
        <a
            href={`${to}/${params?.name ?? ''}/${params?.birthdate ?? ''}`}
            className={className}
            data-testid="person-link"
        >
            {children}
        </a>
    ),
}))

const basePerson: PersonSearchResultDetailed = {
    name: 'Kari Nordmann',
    birthdate: '1985-06-15',
    role_count: 5,
    active_role_count: 3,
    top_roles: ['Styreleder (2)', 'Daglig leder (1)'],
    notable_companies: ['Nordmann AS', 'Test Holding AS'],
}

describe('PersonResultCard', () => {
    it('renders person name', () => {
        render(<PersonResultCard person={basePerson} />)
        expect(screen.getByText('Kari Nordmann')).toBeInTheDocument()
    })

    it('shows birth year extracted from birthdate', () => {
        render(<PersonResultCard person={basePerson} />)
        expect(screen.getByText('Fødselsår: 1985')).toBeInTheDocument()
    })

    it('shows active role count', () => {
        render(<PersonResultCard person={basePerson} />)
        expect(screen.getByText(/3 aktive roller/)).toBeInTheDocument()
    })

    it('shows resigned count when non-zero', () => {
        render(<PersonResultCard person={basePerson} />)
        // role_count=5, active=3 → 2 fratrådt
        expect(screen.getByText('(2 fratrådt)')).toBeInTheDocument()
    })

    it('hides resigned count when zero', () => {
        const person = { ...basePerson, role_count: 3, active_role_count: 3 }
        render(<PersonResultCard person={person} />)
        expect(screen.queryByText(/fratrådt/)).not.toBeInTheDocument()
    })

    it('renders top role pills', () => {
        render(<PersonResultCard person={basePerson} />)
        expect(screen.getByText('Styreleder (2)')).toBeInTheDocument()
        expect(screen.getByText('Daglig leder (1)')).toBeInTheDocument()
    })

    it('renders notable companies', () => {
        render(<PersonResultCard person={basePerson} />)
        expect(screen.getByText('Nordmann AS, Test Holding AS')).toBeInTheDocument()
    })

    it('hides top roles section when empty', () => {
        const person = { ...basePerson, top_roles: [] }
        render(<PersonResultCard person={person} />)
        expect(screen.queryByText('Styreleder (2)')).not.toBeInTheDocument()
    })

    it('hides notable companies section when empty', () => {
        const person = { ...basePerson, notable_companies: [] }
        render(<PersonResultCard person={person} />)
        expect(screen.queryByText('Nordmann AS')).not.toBeInTheDocument()
    })

    it('handles null birthdate gracefully', () => {
        const person = { ...basePerson, birthdate: null }
        render(<PersonResultCard person={person} />)
        expect(screen.queryByText(/Fødselsår/)).not.toBeInTheDocument()
        expect(screen.getByText('Kari Nordmann')).toBeInTheDocument()
    })

    it('uses singular form for one active role', () => {
        const person = { ...basePerson, active_role_count: 1, role_count: 1 }
        render(<PersonResultCard person={person} />)
        expect(screen.getByText(/1 aktiv rolle/)).toBeInTheDocument()
    })

    it('links to correct person route', () => {
        render(<PersonResultCard person={basePerson} />)
        const link = screen.getByTestId('person-link')
        expect(link.getAttribute('href')).toContain('Kari Nordmann')
        expect(link.getAttribute('href')).toContain('1985')
    })
})
