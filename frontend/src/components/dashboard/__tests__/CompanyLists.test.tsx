import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NewestCompaniesList } from '../CompanyLists'
import type { Company } from '../../../types'

vi.mock('@tanstack/react-router', () => ({
    Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}))

describe('NewestCompaniesList', () => {
    it('renders a fallback instead of Invalid Date when stiftelsesdato is missing', () => {
        const companies: Company[] = [{
            orgnr: '123456789',
            navn: 'Mangler Dato AS',
        }]

        render(<NewestCompaniesList companies={companies} regionName="Oslo" />)

        expect(screen.getByLabelText('Mangler Dato AS, stiftelsesdato ukjent')).toBeInTheDocument()
        expect(screen.getByText('Stiftelsesdato ukjent')).toBeInTheDocument()
        expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument()
    })
})