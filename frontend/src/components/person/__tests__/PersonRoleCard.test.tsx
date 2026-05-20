import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PersonRoleCard } from '../PersonRoleCard'
import type { PersonRole } from '../../../types/person'

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, to, params, className, title, ...props }: {
        children: React.ReactNode
        to: string
        params?: Record<string, string>
        className?: string
        title?: string
        [key: string]: unknown
    }) => (
        <a
            href={to.replace('$orgnr', params?.orgnr ?? '')}
            className={className}
            title={title}
            {...props}
        >
            {children}
        </a>
    ),
}))

const longName = 'INFODAS GESELLSCHAFT FÜR SYSTEMENTWICKLUNG UND INFORMATIONSVERARBEITUNG MBH'

const baseRole: PersonRole = {
    orgnr: '932876833',
    type_kode: 'KONT',
    type_beskrivelse: 'Kontaktperson',
    enhet_navn: longName,
    fratraadt: false,
    rekkefoelge: null,
    foedselsdato: null,
    organisasjonsform: 'NUF',
    antall_ansatte: null,
    naeringskode: null,
    stiftelsesdato: null,
    konkurs: false,
    under_avvikling: false,
    latest_aar: 2024,
    latest_salgsinntekter: 82000000,
    latest_aarsresultat: -12516063,
    latest_driftsresultat: null,
    latest_egenkapitalandel: null,
}

describe('PersonRoleCard', () => {
    it('links both the company name and action button to the company page', () => {
        render(<PersonRoleCard role={baseRole} />)

        expect(screen.getByRole('link', { name: longName })).toHaveAttribute('href', '/virksomhet/932876833')
        expect(screen.getByRole('link', { name: `Se virksomhetsprofil for ${longName}` })).toHaveAttribute('href', '/virksomhet/932876833')
    })
})