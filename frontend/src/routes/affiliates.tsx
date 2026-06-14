/* eslint-disable react-refresh/only-export-components */
import { createFileRoute } from '@tanstack/react-router'
import { AffiliateBanner } from '../components/ads/AffiliateBanner'
import { AffiliateLegalNotes } from '../components/ads/AffiliateLegalNotes'
import { SEOHead } from '../components/layout'
import { ALL_AFFILIATIONS } from '../constants/affiliations'

export const Route = createFileRoute('/affiliates')({
  component: AffiliatesPage,
})

export function AffiliatesPage() {
  return (
    <>
      <SEOHead
        title="Affiliates og kommersielle lenker | Bedriftsgrafen.no"
        description="Oversikt over kommersielle affiliate-lenker som kan støtte driften av Bedriftsgrafen.no."
      />

      <div className="mx-auto max-w-7xl">
        <header className="mb-6 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Annonser</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white md:text-3xl">
            Affiliates og kommersielle lenker
          </h1>
          <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-slate-300">
            Denne siden viser kommersielle tjenester vi kan motta provisjon fra. Lenker går via interne redirects, og
            selve tjenestene leveres av eksterne aktører.
          </p>
        </header>

        <section
          aria-label="Alle kommersielle affiliate-lenker"
          className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-4"
        >
          {ALL_AFFILIATIONS.map((affiliation) => (
            <AffiliateBanner
              key={affiliation.id}
              bannerId={`affiliates_${affiliation.id}`}
              placement="affiliates_page"
              legalTextMode="inline"
              {...affiliation}
            />
          ))}
        </section>

        <AffiliateLegalNotes affiliations={ALL_AFFILIATIONS} className="mt-6" />
      </div>
    </>
  )
}
