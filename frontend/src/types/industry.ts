import { Company } from './company'
import { TrendPoint, SectorStat, RankingInfo } from './municipality'

export interface SubclassStat {
    nace_code: string
    nace_name?: string
    company_count: number
    total_employees?: number
    avg_revenue?: number
    avg_operating_margin?: number
}

export interface IndustryPremiumResponse {
    nace_division: string
    nace_name?: string
    nace_section?: string
    nace_section_name?: string

    // Core metrics
    company_count: number
    total_employees?: number
    avg_employees?: number
    total_revenue?: number
    avg_revenue?: number
    median_revenue?: number
    total_profit?: number
    avg_profit?: number
    profitable_count?: number
    avg_operating_margin?: number

    // Activity
    new_last_year: number
    bankruptcies_last_year: number
    bankrupt_count: number

    // Trends
    establishment_trend: TrendPoint[]
    bankrupt_trend: TrendPoint[]

    // Subclass breakdown
    subclasses: SubclassStat[]

    // Geographic distribution (top counties)
    top_counties: SectorStat[]

    // Company lists
    top_companies: Company[]
    newest_companies: Company[]
    latest_bankruptcies: Company[]

    // Rankings vs other industries
    ranking_by_revenue?: RankingInfo
    ranking_by_companies?: RankingInfo
    ranking_by_employees?: RankingInfo
}
