import type { Affiliation } from '../../constants/affiliations'

interface AffiliateLegalNotesProps {
    affiliations: Affiliation[]
    className?: string
}

export function AffiliateLegalNotes({ affiliations, className }: AffiliateLegalNotesProps) {
    const legalAffiliations = affiliations.filter((affiliation) => affiliation.legalText)

    if (legalAffiliations.length === 0) return null

    return (
        <div
            aria-label="Renteeksempler og vilkår"
            className={`rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-600 ${className ?? ''}`}
        >
            <p className="mb-1 font-semibold text-gray-800">Renteeksempler og vilkår</p>
            <div className="grid gap-2 lg:grid-cols-2">
                {legalAffiliations.map((affiliation) => (
                    <p key={affiliation.id}>
                        <span className="font-semibold text-gray-800">{affiliation.name}: </span>
                        {affiliation.legalText}
                    </p>
                ))}
            </div>
        </div>
    )
}