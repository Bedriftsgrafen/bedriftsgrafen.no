import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AFFILIATIONS, GLOBAL_AFFILIATIONS } from '../../../constants/affiliations'
import { selectRotatingAffiliation } from '../../../utils/affiliateRotation'
import { RotatingAffiliateBanner } from '../RotatingAffiliateBanner'

vi.mock('../../../utils/analytics', () => ({
    trackAffiliateClick: vi.fn(),
}))

describe('RotatingAffiliateBanner', () => {
    it('selects one stable affiliation per placement and day', () => {
        const rotationDate = new Date('2026-05-20T12:00:00Z')

        const first = selectRotatingAffiliation(GLOBAL_AFFILIATIONS, 'nyetableringer_top', rotationDate)
        const second = selectRotatingAffiliation(GLOBAL_AFFILIATIONS, 'nyetableringer_top', rotationDate)

        expect(first).toBe(second)
        expect(GLOBAL_AFFILIATIONS).toContain(first)
    })

    it('renders only the selected single affiliate', () => {
        render(
            <RotatingAffiliateBanner
                placement="test_top"
                candidates={[AFFILIATIONS.TJENESTETORGET_ACCOUNTANT]}
                rotationDate={new Date('2026-05-20T12:00:00Z')}
            />
        )

        expect(screen.getAllByText('Annonse')).toHaveLength(1)
        expect(screen.getByRole('link', { name: /Sammenlign tilbud hos Tjenestetorget/i })).toHaveAttribute(
            'href',
            '/api/v1/affiliates/tjenestetorget'
        )
    })

    it('applies contextual copy overrides to the selected affiliate', () => {
        render(
            <RotatingAffiliateBanner
                placement="konkurser_top"
                candidates={[AFFILIATIONS.TJENESTETORGET_ACCOUNTANT]}
                copyOverrides={{
                    [AFFILIATIONS.TJENESTETORGET_ACCOUNTANT.id]: {
                        title: 'Ny start med regnskapsfører hos Tjenestetorget',
                    },
                }}
                rotationDate={new Date('2026-05-20T12:00:00Z')}
            />
        )

        expect(screen.getByText('Ny start med regnskapsfører hos Tjenestetorget')).toBeInTheDocument()
    })

    it('keeps required loan terms inside the single ad card', () => {
        render(
            <RotatingAffiliateBanner
                placement="loan_top"
                candidates={[AFFILIATIONS.ZENSUM_LOAN]}
                rotationDate={new Date('2026-05-20T12:00:00Z')}
            />
        )

        expect(screen.queryByLabelText('Renteeksempler og vilkår')).not.toBeInTheDocument()
        expect(screen.getByText(/Eksempel lån uten sikkerhet/i)).toBeInTheDocument()
    })
})