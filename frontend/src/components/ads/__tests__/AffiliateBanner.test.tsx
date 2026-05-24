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

    it('renders compact logos with explicit dimensions and lazy decoding', () => {
        const { container } = render(
            <AffiliateBanner {...defaultProps} logo="/logo.png" logoWidth={120} logoHeight={40} />
        )

        const logo = container.querySelector('img')
        expect(logo).toHaveAttribute('src', '/logo.png')
        expect(logo).toHaveAttribute('width', '120')
        expect(logo).toHaveAttribute('height', '40')
        expect(logo).toHaveAttribute('loading', 'lazy')
        expect(logo).toHaveAttribute('decoding', 'async')
    })

    it('only shows legal text when inline terms are enabled', () => {
        const legalText = 'Eksempel lån uten sikkerhet: effektiv rente 19,92 %, 65 000 kr o/5 år.'

        const { rerender } = render(<AffiliateBanner {...defaultProps} legalText={legalText} />)

        expect(screen.queryByText(/Eksempel lån uten sikkerhet/i)).not.toBeInTheDocument()

        rerender(<AffiliateBanner {...defaultProps} legalText={legalText} legalTextMode="inline" />)

        expect(screen.getByText(/Eksempel lån uten sikkerhet/i)).toBeInTheDocument()
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

        expect(screen.queryByRole('link', { name: /Test Button/i })).not.toBeInTheDocument()
        expect(screen.getByText('Test Button')).toHaveAttribute('aria-disabled', 'true')
        expect(trackAffiliateClick).not.toHaveBeenCalled()
    })

    it('opens confirmation modal for Bedriftsgrafen contact links', async () => {
        render(<AffiliateBanner {...defaultProps} link={`mailto:${CONTACT_EMAIL}`} buttonText="Kontakt Bedriftsgrafen" />)

        const button = screen.getByRole('button', { name: 'Kontakt Bedriftsgrafen' })
        fireEvent.click(button)

        expect(trackAffiliateClick).toHaveBeenCalledWith(
            'test_banner',
            'accounting',
            'test_placement'
        )
        expect(await screen.findByRole('heading', { name: 'Partnerskap med Bedriftsgrafen.no' })).toBeInTheDocument()
        expect(screen.getByText('Du kontakter Bedriftsgrafen.no, ikke en virksomhet eller person omtalt på siden.')).toBeInTheDocument()
    })

    it('recognizes Bedriftsgrafen contact links with subjects', async () => {
        render(<AffiliateBanner {...defaultProps} link={`mailto:${CONTACT_EMAIL}?subject=Partnerskap`} buttonText="Kontakt Bedriftsgrafen" />)

        fireEvent.click(screen.getByRole('button', { name: 'Kontakt Bedriftsgrafen' }))

        expect(await screen.findByRole('heading', { name: 'Partnerskap med Bedriftsgrafen.no' })).toBeInTheDocument()
    })

    it('inherits company-page confirmation for Bedriftsgrafen contact links', async () => {
        window.history.pushState({}, '', '/virksomhet/123456789')
        render(<AffiliateBanner {...defaultProps} link={`mailto:${CONTACT_EMAIL}`} buttonText="Kontakt Bedriftsgrafen" />)

        fireEvent.click(screen.getByRole('button', { name: 'Kontakt Bedriftsgrafen' }))

        expect(await screen.findByText('Du kontakter Bedriftsgrafen.no, ikke virksomheten på siden.')).toBeInTheDocument()

        const emailLink = screen.getByRole('link', { name: 'Åpne e-postutkast' })
        expect(emailLink).toHaveAttribute('aria-disabled', 'true')
    })
})
