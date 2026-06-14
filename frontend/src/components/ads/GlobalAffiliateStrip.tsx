import { AffiliateBanner } from './AffiliateBanner'
import { AffiliateLegalNotes } from './AffiliateLegalNotes'
import { ALL_AFFILIATIONS, GLOBAL_AFFILIATION_LIMIT } from '../../constants/affiliations'
import { selectRotatingAffiliations } from '../../utils/affiliateRotation'

interface GlobalAffiliateStripProps {
    rotationDate?: Date
}

export function GlobalAffiliateStrip({ rotationDate }: GlobalAffiliateStripProps) {
    const visibleAffiliations = selectRotatingAffiliations(
        ALL_AFFILIATIONS,
        'global_sitewide',
        GLOBAL_AFFILIATION_LIMIT,
        rotationDate
    )

    return (
        <section
            aria-labelledby="global-affiliate-heading"
            className="border-t border-gray-200 bg-white transition-colors duration-300 dark:border-slate-800 dark:bg-slate-950"
        >
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">Annonser</p>
                        <h2 id="global-affiliate-heading" className="text-xl font-semibold text-gray-900 dark:text-white">
                            Aktuelle tjenester
                        </h2>
                    </div>
                    <p className="max-w-2xl text-sm text-gray-600 dark:text-slate-300">
                        Utvalgte kommersielle lenker som støtter driften av Bedriftsgrafen.no.
                    </p>
                </div>

                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4">
                    {visibleAffiliations.map((affiliation) => (
                        <AffiliateBanner
                            key={affiliation.id}
                            bannerId={`global_${affiliation.id}`}
                            placement="global_sitewide"
                            {...affiliation}
                        />
                    ))}
                </div>

                <AffiliateLegalNotes affiliations={visibleAffiliations} className="mt-4" />
            </div>
        </section>
    )
}
