/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from '@tanstack/react-router'
import { SEOHead } from '../components/layout'
import { PrivacyPage } from '../components/trust/TrustPages'

export const Route = createFileRoute('/personvern')({
  component: PersonvernRoute,
})

function PersonvernRoute() {
  return (
    <>
      <SEOHead
        title="Personvern | Bedriftsgrafen.no"
        description="Les hvordan Bedriftsgrafen.no behandler offentlige registeropplysninger, tekniske logger, analyse og personvernhenvendelser."
      />
      <PrivacyPage />
    </>
  )
}