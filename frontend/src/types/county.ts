import { Company } from './company'
import { TrendPoint, SectorStat, RankingInfo } from './municipality'

export interface MunicipalitySummary {
    code: string
    name: string
    company_count: number
    population?: number
}

export interface CountyPremiumResponse {
    code: string
    name: string

    // Coordinates
    lat?: number
    lng?: number

    // SSB Population Data (aggregated)
    population: number
    population_growth_1y?: number

    // Business Metrics
    company_count: number
    municipality_count: number
    business_density?: number
    business_density_national_avg?: number

    // Performance Stats
    total_revenue?: number
    avg_profit_margin?: number

    // Trends
    establishment_trend: TrendPoint[]
    bankrupt_trend: TrendPoint[]

    // Categorical Data
    top_sectors: SectorStat[]
    top_companies: Company[]
    newest_companies: Company[]
    latest_bankruptcies: Company[]

    // Rankings (national)
    ranking_national_density?: RankingInfo
    ranking_national_revenue?: RankingInfo
    ranking_national_population?: RankingInfo

    // Drill-down navigation
    municipalities: MunicipalitySummary[]
}

export interface CountyListItem {
    code: string
    name: string
    company_count: number
    municipality_count: number
    population?: number
    lat?: number
    lng?: number
}
