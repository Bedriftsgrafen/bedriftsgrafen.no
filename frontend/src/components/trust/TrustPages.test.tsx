import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DataSourcesPage, PrivacyPage, TermsPage } from './TrustPages'

describe('TrustPages', () => {
  it('explains Bedriftsgrafen data sources without overclaiming paid announcements', () => {
    render(<DataSourcesPage />)

    expect(screen.getByRole('heading', { name: 'Datakilder og datakvalitet' })).toBeInTheDocument()
    expect(screen.getByText(/Bedriftsgrafen.no er ikke et offisielt register/i)).toBeInTheDocument()
    expect(screen.getByText(/Regnskapsoppdateringer betyr at Bedriftsgrafen har lagt til eller oppdatert et regnskap/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Oppdateringer og datastatus/i })).toHaveAttribute('href', '/oppdateringer?tab=datastatus')
  })

  it('describes public role data, analytics and rights on the privacy page', () => {
    render(<PrivacyPage />)

    expect(screen.getByRole('heading', { name: 'Personvern og behandling av opplysninger' })).toBeInTheDocument()
    expect(screen.getByText(/Vi viser ikke fødselsnummer/i)).toBeInTheDocument()
    expect(screen.getByText(/Google Analytics 4 med IP-anonymisering/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kontakt oss om personvern' })).toBeInTheDocument()
  })

  it('states practical terms for decisions and automated use', () => {
    render(<TermsPage />)

    expect(screen.getByRole('heading', { name: 'Vilkår for bruk' })).toBeInTheDocument()
    expect(screen.getByText(/ikke brukes som eneste grunnlag/i)).toBeInTheDocument()
    expect(screen.getByText(/Ikke bruk automatisert trafikk, scraping eller masseuthenting/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kontakt Bedriftsgrafen.no' })).toBeInTheDocument()
  })
})