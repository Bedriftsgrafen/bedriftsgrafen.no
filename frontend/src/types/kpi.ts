/**
 * KPI (Key Performance Indicator) types for financial analysis
 */

// Kpis and AccountingWithKpis are exported from company.ts to avoid circular imports
export { type Kpis, type AccountingWithKpis } from './company'

export interface KpiCardData {
  label: string
  value: number | null
  format: 'number' | 'percent' | 'currency'
  description?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: number
}
