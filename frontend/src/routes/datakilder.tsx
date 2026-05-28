/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from '@tanstack/react-router'
import { SEOHead } from '../components/layout'
import { DataSourcesPage } from '../components/trust/TrustPages'

export const Route = createFileRoute('/datakilder')({
  component: DatakilderRoute,
})

function DatakilderRoute() {
  return (
    <>
      <SEOHead
        title="Datakilder og datakvalitet | Bedriftsgrafen.no"
        description="Se hvilke åpne datakilder Bedriftsgrafen.no bruker, hvordan data oppdateres, og hvilke begrensninger du bør kjenne til."
      />
      <DataSourcesPage />
    </>
  )
}