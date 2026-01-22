import { Company } from './company'

export interface TrendPoint {
    label: string
    value: number
}

export interface SectorStat {
    nace_division: string
    nace_name: string
    company_count: number
    total_employees?: number
    percentage_of_total?: number
}

export interface RankingInfo {
    rank: number
    out_of: number
}

export interface MunicipalityPremiumResponse {
    code: string
    name: string
    county_code: string
    county_name: string

    // Coordinates
    lat?: number
    lng?: number

    // SSB Population Data
    population: number
    population_growth_1y?: number

    // Business Metrics
    company_count: number
    business_density?: number
    business_density_national_avg?: number

    // Performance Stats
    total_revenue?: number
    avg_profit_margin?: number

    // Trends
    establishment_trend: TrendPoint[]

    // Categorical Data
    top_sectors: SectorStat[]
    top_companies: Company[]
    newest_companies: Company[]
    latest_bankruptcies: Company[]

    // Rankings
    ranking_in_county_density?: RankingInfo
    ranking_in_county_revenue?: RankingInfo
}

export interface MunicipalityListItem {
    code: string
    name: string
    slug: string
    company_count: number
    population?: number
    lat?: number
    lng?: number
}
