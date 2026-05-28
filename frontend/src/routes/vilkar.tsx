/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from '@tanstack/react-router'
import { SEOHead } from '../components/layout'
import { TermsPage } from '../components/trust/TrustPages'

export const Route = createFileRoute('/vilkar')({
  component: VilkarRoute,
})

function VilkarRoute() {
  return (
    <>
      <SEOHead
        title="Vilkår for bruk | Bedriftsgrafen.no"
        description="Vilkår for ansvarlig bruk av Bedriftsgrafen.no, inkludert databegrensninger, tillatt bruk og ansvar ved beslutninger."
      />
      <TermsPage />
    </>
  )
}