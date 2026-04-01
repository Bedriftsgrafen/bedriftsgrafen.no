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
