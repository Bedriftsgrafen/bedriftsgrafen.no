export interface PersonSearchResultDetailed {
    name: string
    birthdate: string | null
    role_count: number
    active_role_count: number
    top_roles: string[]
    notable_companies: string[]
}

export interface PaginatedPersonSearch {
    results: PersonSearchResultDetailed[]
    total_count: number
    query: string
}

/** A person's commercial role enriched with company context and latest financials. */
export interface PersonRole {
    orgnr: string
    type_kode: string
    type_beskrivelse: string
    enhet_navn: string
    fratraadt: boolean
    rekkefoelge: number | null
    foedselsdato: string | null

    // Company context
    organisasjonsform: string | null
    antall_ansatte: number | null
    naeringskode: string | null
    stiftelsesdato: string | null
    konkurs: boolean
    under_avvikling: boolean

    // Latest financials
    latest_aar: number | null
    latest_salgsinntekter: number | null
    latest_aarsresultat: number | null
    latest_driftsresultat: number | null
    latest_egenkapitalandel: number | null
}
