import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PersonResultRow } from '../PersonResultRow'
import type { PersonSearchResultDetailed } from '../../../types/person'

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, params, className }: {
        children: React.ReactNode
        to: string
        params?: Record<string, string>
        className?: string
    }) => (
        <tr className={className} data-birthdate={params?.birthdate} data-testid="person-row">
            {children}
        </tr>
    ),
}))

const basePerson: PersonSearchResultDetailed = {
    name: 'Ola Hansen',
    birthdate: '1972-03-20',
    role_count: 8,
    active_role_count: 4,
    top_roles: ['Styremedlem (3)', 'Daglig leder (1)'],
    notable_companies: ['Hansen Invest AS'],
}

describe('PersonResultRow', () => {
    it('renders person name', () => {
        render(
            <table><tbody><PersonResultRow person={basePerson} /></tbody></table>
        )
        expect(screen.getByText('Ola Hansen')).toBeInTheDocument()
    })

    it('renders birth year extracted from birthdate', () => {
        render(
            <table><tbody><PersonResultRow person={basePerson} /></tbody></table>
        )
        expect(screen.getByText('1972')).toBeInTheDocument()
    })

    it('renders active role count', () => {
        render(
            <table><tbody><PersonResultRow person={basePerson} /></tbody></table>
        )
        expect(screen.getByText('4')).toBeInTheDocument()
    })

    it('renders total role count', () => {
        render(
            <table><tbody><PersonResultRow person={basePerson} /></tbody></table>
        )
        expect(screen.getByText('8')).toBeInTheDocument()
    })

    it('renders top role with count suffix stripped', () => {
        render(
            <table><tbody><PersonResultRow person={basePerson} /></tbody></table>
        )
        // "Styremedlem (3)" → "Styremedlem"
        expect(screen.getByText('Styremedlem')).toBeInTheDocument()
    })

    it('renders first notable company', () => {
        render(
            <table><tbody><PersonResultRow person={basePerson} /></tbody></table>
        )
        expect(screen.getByText('Hansen Invest AS')).toBeInTheDocument()
    })

    it('shows em-dash for missing top role', () => {
        const person = { ...basePerson, top_roles: [] }
        render(
            <table><tbody><PersonResultRow person={person} /></tbody></table>
        )
        const dashes = screen.getAllByText('—')
        expect(dashes.length).toBeGreaterThanOrEqual(1)
    })

    it('shows em-dash for missing notable company', () => {
        const person = { ...basePerson, notable_companies: [] }
        render(
            <table><tbody><PersonResultRow person={person} /></tbody></table>
        )
        const dashes = screen.getAllByText('—')
        expect(dashes.length).toBeGreaterThanOrEqual(1)
    })

    it('shows em-dash for null birthdate', () => {
        const person = { ...basePerson, birthdate: null }
        render(
            <table><tbody><PersonResultRow person={person} /></tbody></table>
        )
        const dashes = screen.getAllByText('—')
        expect(dashes.length).toBeGreaterThanOrEqual(1)
    })

    it('links with "unknown" birthdate when null', () => {
        const person = { ...basePerson, birthdate: null }
        render(
            <table><tbody><PersonResultRow person={person} /></tbody></table>
        )
        const row = screen.getByTestId('person-row')
        expect(row.getAttribute('data-birthdate')).toBe('unknown')
    })
})
