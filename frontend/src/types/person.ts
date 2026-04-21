export type PersonSortField = 'role_count' | 'active_roles' | 'name'
export type PersonSortOrder = 'asc' | 'desc'
export type PersonViewMode = 'cards' | 'list'

export const PERSON_ITEMS_PER_PAGE = 20

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

/** A company shared between two people. */
export interface SharedCompanyInfo {
    orgnr: string
    navn: string
    person_role: string
    connection_role: string
}

/** A person connected via shared board/role memberships.
 *  GDPR: birth_year (number) instead of full birthdate for third parties. */
export interface PersonConnection {
    name: string
    birth_year: number | null
    shared_company_count: number
    shared_companies: SharedCompanyInfo[]
}

export interface SparklinePoint {
    aar: number
    salgsinntekter: number | null
    aarsresultat: number | null
}

export interface CompanySparklineData {
    orgnr: string
    data_points: SparklinePoint[]
}

export interface NetworkPathNode {
    type: 'person' | 'company'
    name: string
    identifier: string
    role: string | null
}

export interface NetworkPathResponse {
    found: boolean
    depth: number | null
    path: NetworkPathNode[]
}

// --- Person Toplist & Stats types ---

export type ToplistCategory =
    | 'active_roles'
    | 'LEDE'
    | 'DAGL'
    | 'MEDL'
    | 'active_companies'
    | 'industry_diversity'
    | 'salgsinntekter'

export interface PersonToplistEntry {
    rank: number
    name: string
    birth_year: number | null
    value: number
    active_roles: number
    active_companies: number
}

export interface PersonToplistResponse {
    category: ToplistCategory
    entries: PersonToplistEntry[]
}

export interface RoleTypeCount {
    type_kode: string
    type_beskrivelse: string
    count: number
}

export interface GenerationCount {
    generation: string
    birth_year_range: string
    count: number
}

export interface PersonAggregateStats {
    total_persons: number
    total_active_roles: number
    role_type_distribution: RoleTypeCount[]
    generation_distribution: GenerationCount[]
    avg_board_age: number
}
