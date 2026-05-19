import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AffiliateBanner } from '../AffiliateBanner'
import { trackAffiliateClick } from '../../../utils/analytics'
import { Calculator } from 'lucide-react'
import { CONTACT_EMAIL } from '../../../constants/contact'

// Mock analytics
vi.mock('../../../utils/analytics', () => ({
    trackAffiliateClick: vi.fn(),
}))

describe('AffiliateBanner', () => {
    const defaultProps = {
        bannerId: 'test_banner',
        placement: 'test_placement',
        title: 'Test Title',
        description: 'Test Description',
        buttonText: 'Test Button',
        link: 'https://example.com/affiliate',
        variant: 'accounting' as const,
        icon: Calculator,
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        window.history.pushState({}, '', '/')
    })

    it('renders with correct content', () => {
        render(<AffiliateBanner {...defaultProps} />)

        expect(screen.getByText('Test Title')).toBeInTheDocument()
        expect(screen.getByText('Test Description')).toBeInTheDocument()
        expect(screen.getByText('Test Button')).toBeInTheDocument()
        expect(screen.getByText('Annonse')).toBeInTheDocument()
    })

    it('has correct link attributes for marketing compliance', () => {
        render(<AffiliateBanner {...defaultProps} />)

        const link = screen.getByRole('link', { name: /Test Button/i })
        expect(link).toHaveAttribute('href', 'https://example.com/affiliate')
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('rel', 'noopener noreferrer sponsored')
    })

    it('tracks clicks correctly', () => {
        render(<AffiliateBanner {...defaultProps} />)

        const link = screen.getByRole('link', { name: /Test Button/i })
        fireEvent.click(link)

        expect(trackAffiliateClick).toHaveBeenCalledWith(
            'test_banner',
            'accounting',
            'test_placement'
        )
    })

    it('renders as non-interactive when no link is provided (placeholder)', () => {
        render(<AffiliateBanner {...defaultProps} link="#" isPlaceholder={true} />)

        const link = screen.getByRole('link', { name: /Test Button/i })
        expect(link).toHaveAttribute('href', '#')
        expect(link).not.toHaveAttribute('target')
        expect(link).not.toHaveAttribute('rel')

        fireEvent.click(link)
        // Should still track the click (for internal placeholders to see interest)
        expect(trackAffiliateClick).toHaveBeenCalled()
    })

    it('opens confirmation modal for Bedriftsgrafen contact links', () => {
        render(<AffiliateBanner {...defaultProps} link={`mailto:${CONTACT_EMAIL}`} buttonText="Kontakt Bedriftsgrafen" />)

        const button = screen.getByRole('button', { name: 'Kontakt Bedriftsgrafen' })
        fireEvent.click(button)

        expect(trackAffiliateClick).toHaveBeenCalledWith(
            'test_banner',
            'accounting',
            'test_placement'
        )
        expect(screen.getByRole('heading', { name: 'Partnerskap med Bedriftsgrafen.no' })).toBeInTheDocument()
        expect(screen.getByText('Du kontakter Bedriftsgrafen.no, ikke en virksomhet eller person omtalt på siden.')).toBeInTheDocument()
    })

    it('recognizes Bedriftsgrafen contact links with subjects', () => {
        render(<AffiliateBanner {...defaultProps} link={`mailto:${CONTACT_EMAIL}?subject=Partnerskap`} buttonText="Kontakt Bedriftsgrafen" />)

        fireEvent.click(screen.getByRole('button', { name: 'Kontakt Bedriftsgrafen' }))

        expect(screen.getByRole('heading', { name: 'Partnerskap med Bedriftsgrafen.no' })).toBeInTheDocument()
    })

    it('inherits company-page confirmation for Bedriftsgrafen contact links', () => {
        window.history.pushState({}, '', '/virksomhet/123456789')
        render(<AffiliateBanner {...defaultProps} link={`mailto:${CONTACT_EMAIL}`} buttonText="Kontakt Bedriftsgrafen" />)

        fireEvent.click(screen.getByRole('button', { name: 'Kontakt Bedriftsgrafen' }))

        expect(screen.getByText('Du kontakter Bedriftsgrafen.no, ikke virksomheten på siden.')).toBeInTheDocument()

        const emailLink = screen.getByRole('link', { name: `Åpne e-post til ${CONTACT_EMAIL}` })
        expect(emailLink).toHaveAttribute('aria-disabled', 'true')
    })
})
